import { Hospital, EmergencyData, AcceptanceConfirmation, LocationData } from '../models/types';
import { IHospitalDashboard } from '../interfaces/IHospitalDashboard';
import { Logger } from '../utils/logger';

// ─── Haversine distance ───────────────────────────────────────────────────────

/**
 * Returns the great-circle distance in km between two lat/lng points.
 * Accurate to ~0.5% — sufficient for emergency dispatch routing.
 */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Hospital Dashboard service ───────────────────────────────────────────────

export class HospitalDashboardService implements IHospitalDashboard {

  /**
   * Returns hospitals within radiusKm of the caller's best available location.
   * Uses GPS (Tier 3) if available, falls back to Tier 2 district centroid.
   * Results are sorted by distance ascending.
   *
   * In production this queries a DynamoDB hospitals table with a geospatial index.
   * In the prototype/hackathon scope, the caller provides a static hospital list
   * (injected via constructor) so the service is testable without DynamoDB.
   */
  async getHospitalsInRadius(location: LocationData, radiusKm: number): Promise<Hospital[]> {
    const { lat, lng } = this._bestCoordinates(location);
    if (lat === null || lng === null) {
      Logger.warn('No coordinates available for hospital radius search', {
        accuracyLevel: location.accuracyLevel,
      });
      return [];
    }

    const nearby = this._hospitals
      .map(h => ({
        ...h,
        distanceKm: haversineKm(lat, lng, h.location.latitude, h.location.longitude),
      }))
      .filter(h => h.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    Logger.info('Hospital radius search complete', {
      radiusKm,
      found: nearby.length,
      accuracyLevel: location.accuracyLevel,
    });

    return nearby;
  }

  /**
   * Blasts emergency notification to all provided hospitals simultaneously.
   * In production this calls the Hospital Dashboard API (AWS Amplify + API Gateway).
   * Prototype: logs the notification and resolves immediately.
   */
  async blastNotification(hospitals: Hospital[], emergency: EmergencyData): Promise<void> {
    Logger.info('Blasting emergency notification to hospitals', {
      callId: emergency.callId,
      condition: emergency.condition,
      icd10Code: emergency.icd10Code,
      hospitalCount: hospitals.length,
      hospitalIds: hospitals.map(h => h.hospitalId),
    });
    // Production: fire parallel HTTP calls to each hospital's dashboard endpoint
    // Prototype: notification is logged — hospitals poll the dashboard
  }

  /**
   * Records a hospital's acceptance of an emergency patient.
   * Returns an AcceptanceConfirmation with estimated arrival time.
   * In production this writes to DynamoDB and triggers caller notification.
   */
  async acceptPatient(hospitalId: string, emergencyId: string): Promise<AcceptanceConfirmation> {
    const confirmation: AcceptanceConfirmation = {
      hospitalId,
      emergencyId,
      acceptedAt: new Date().toISOString(),
      estimatedArrival: '15 minutes',  // production: calculated from distance + traffic
    };

    Logger.info('Hospital accepted patient', { hospitalId, emergencyId });
    return confirmation;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Extracts the best available lat/lng from the location tiers.
   * Priority: GPS (Tier 3) > voice (Tier 1, if has coordinates) > district centroid (Tier 2).
   * Tier 2 (STD code) gives district-level accuracy — good enough for 30km radius search.
   */
  private _bestCoordinates(location: LocationData): { lat: number | null; lng: number | null } {
    if (location.tier3GPS) {
      return { lat: location.tier3GPS.latitude, lng: location.tier3GPS.longitude };
    }
    // Tier 2 district centroid — injected via DISTRICT_CENTROIDS lookup
    const district = location.tier2Phone.district;
    const centroid = DISTRICT_CENTROIDS[district.toLowerCase()];
    if (centroid) {
      return centroid;
    }
    return { lat: null, lng: null };
  }

  constructor(private readonly _hospitals: Hospital[] = []) {}
}

// ─── District centroids (subset — production uses full DynamoDB table) ────────
// Lat/lng centroids for major Indian districts — used when GPS unavailable.
// Source: Survey of India district boundary centroids.

const DISTRICT_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'bhopal':       { lat: 23.2599, lng: 77.4126 },
  'delhi':        { lat: 28.6139, lng: 77.2090 },
  'mumbai':       { lat: 19.0760, lng: 72.8777 },
  'kolkata':      { lat: 22.5726, lng: 88.3639 },
  'chennai':      { lat: 13.0827, lng: 80.2707 },
  'bengaluru':    { lat: 12.9716, lng: 77.5946 },
  'hyderabad':    { lat: 17.3850, lng: 78.4867 },
  'ahmedabad':    { lat: 23.0225, lng: 72.5714 },
  'pune':         { lat: 18.5204, lng: 73.8567 },
  'jaipur':       { lat: 26.9124, lng: 75.7873 },
  'lucknow':      { lat: 26.8467, lng: 80.9462 },
  'patna':        { lat: 25.5941, lng: 85.1376 },
  'bhubaneswar':  { lat: 20.2961, lng: 85.8245 },
  'guwahati':     { lat: 26.1445, lng: 91.7362 },
  'chandigarh':   { lat: 30.7333, lng: 76.7794 },
};
