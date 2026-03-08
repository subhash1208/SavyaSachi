import { LocationData, Facility, FacilityCapabilities } from '../models/types';
import { FacilityLevel } from '../models/enums';
import { IReferralAgent } from '../interfaces/IReferralAgent';
import { Logger } from '../utils/logger';

// ─── DynamoDB client type for DI ─────────────────────────────────────────────

export interface IFacilityRepository {
  findByLocationAndLevel(district: string, state: string, level: FacilityLevel): Promise<Facility[]>;
  getCapabilities(facilityId: string): Promise<FacilityCapabilities | null>;
}

// ─── IPHS Facility Level hierarchy ───────────────────────────────────────────
// IPHS (Indian Public Health Standards) defines facility capabilities:
//   PHC: basic outpatient, ORS, first aid, immunization
//   CHC: inpatient, minor surgery, blood storage, 24/7 emergency
//   District Hospital: ICU, blood bank, major surgery, specialist care

const FACILITY_LEVEL_RANK: Record<FacilityLevel, number> = {
  PHC: 1,
  CHC: 2,
  district_hospital: 3,
};

// ─── Referral Agent ──────────────────────────────────────────────────────────

export class ReferralAgentService implements IReferralAgent {

  constructor(private readonly _facilityRepo: IFacilityRepository) {}

  /**
   * Finds the nearest facility that meets or exceeds the required level.
   * Uses IPHS hierarchy: if CHC is required but only a district_hospital
   * is nearby, the district_hospital qualifies (it has CHC capabilities + more).
   *
   * Real-world scenario: A caller in a remote village with urgent dengue fever
   * needs a CHC. The nearest CHC is 45km away, but a district hospital is 30km.
   * The district hospital is returned because it exceeds CHC capabilities.
   *
   * Req 7.4: Identify nearest appropriate facility based on condition severity,
   * IPHS facility capabilities, and caller location.
   */
  async findNearestFacility(location: LocationData, requiredLevel: FacilityLevel): Promise<Facility> {
    const district = this._extractDistrict(location);
    const state = this._extractState(location);

    try {
      const facilities = await this._facilityRepo.findByLocationAndLevel(district, state, requiredLevel);

      // Filter to facilities that meet or exceed the required level
      const qualifying = facilities.filter(
        f => FACILITY_LEVEL_RANK[f.facilityLevel] >= FACILITY_LEVEL_RANK[requiredLevel]
      );

      if (qualifying.length === 0) {
        Logger.warn('No qualifying facility found, returning fallback', { district, state, requiredLevel });
        return this._buildFallbackFacility(district, state, requiredLevel);
      }

      // Sort by distance (nearest first) — distanceKm is set by the repository
      qualifying.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

      Logger.info('Nearest facility found', {
        facilityId: qualifying[0].facilityId,
        level: qualifying[0].facilityLevel,
        distanceKm: qualifying[0].distanceKm,
      });

      return qualifying[0];
    } catch (err) {
      Logger.error('Facility lookup failed, returning fallback', {
        district,
        error: (err as Error).message,
      });
      return this._buildFallbackFacility(district, state, requiredLevel);
    }
  }

  /**
   * Returns the capabilities of a specific facility.
   * Used by the Action Orchestrator to verify the referral is appropriate.
   *
   * Req 7.4: IPHS facility capabilities.
   */
  async getFacilityCapabilities(facilityId: string): Promise<FacilityCapabilities> {
    try {
      const caps = await this._facilityRepo.getCapabilities(facilityId);
      if (caps) return caps;
    } catch (err) {
      Logger.error('Capability lookup failed', { facilityId, error: (err as Error).message });
    }

    // Fallback: return default capabilities based on assumed PHC level
    return this._buildDefaultCapabilities(facilityId, 'PHC');
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private _extractDistrict(location: LocationData): string {
    // Prefer phone-prefix district (reliable, automatic) over voice-extracted district.
    // Voice extraction can mishear district names (e.g., "Sehore" → "Sehor" → no match).
    // Phone-prefix district is derived from STD code lookup — always accurate.
    // Voice district is used as a refinement only when phone district is unavailable.
    return location.tier2Phone.district || (location.tier1Voice?.district ?? '');
  }

  private _extractState(location: LocationData): string {
    return location.tier2Phone.state || (location.tier1Voice?.state ?? '');
  }

  /**
   * Fallback facility when DynamoDB lookup fails or returns empty.
   * Returns a generic district-level facility so the caller still gets
   * a referral rather than nothing.
   */
  private _buildFallbackFacility(district: string, state: string, level: FacilityLevel): Facility {
    return {
      facilityId: `fallback-${district.toLowerCase().replace(/\s+/g, '-')}`,
      name: `${district} ${this._facilityLevelLabel(level)}`,
      address: `${district}, ${state}`,
      phone: '108',  // Universal emergency number as fallback
      facilityLevel: level,
    };
  }

  private _buildDefaultCapabilities(facilityId: string, level: FacilityLevel): FacilityCapabilities {
    return {
      facilityId,
      facilityLevel: level,
      hasICU: level === 'district_hospital',
      hasBloodBank: level === 'district_hospital',
      hasSurgery: level === 'district_hospital' || level === 'CHC',
      hasMaternity: level !== 'PHC',
      hasPediatrics: level !== 'PHC',
      bedCount: level === 'district_hospital' ? 100 : level === 'CHC' ? 30 : 6,
    };
  }

  private _facilityLevelLabel(level: FacilityLevel): string {
    switch (level) {
      case 'PHC': return 'Primary Health Centre';
      case 'CHC': return 'Community Health Centre';
      case 'district_hospital': return 'District Hospital';
    }
  }
}
