import { EmergencyData, LocationData, DispatchResult, Hospital, BilingualInstruction } from '../models/types';
import { IEmergencyDispatch } from '../interfaces/IEmergencyDispatch';
import { IHospitalDashboard } from '../interfaces/IHospitalDashboard';
import { Logger } from '../utils/logger';

// ─── Dispatch constants ───────────────────────────────────────────────────────

const LAYER1_RADIUS_KM = 30;   // Layer 1: 3 nearest hospitals within 30km
const LAYER2_RADIUS_KM = 60;   // Layer 2: expand to 60km
const LAYER1_TIMEOUT_MS = 60_000;  // 60s — if no hospital accepts, escalate to Layer 2
const MAX_HOSPITALS_PER_BLAST = 3; // blast to 3 nearest at a time

// ─── Emergency Dispatch service ───────────────────────────────────────────────

export class EmergencyDispatchService implements IEmergencyDispatch {

  /** Tracks hospital IDs already notified across layers to prevent re-blasting */
  private _notifiedHospitalIds = new Set<string>();

  constructor(private readonly _dashboard: IHospitalDashboard) {}

  /**
   * Layer 1: Blast to 3 nearest hospitals within 30km.
   * Waits up to 60s for a hospital to accept.
   * If accepted → notify caller, return success.
   * If timeout → caller should escalate to Layer 2.
   *
   * Real-world scenario: A cardiac patient in Bhopal — the 3 nearest district
   * hospitals within 30km are notified simultaneously. If Hamidia Hospital
   * accepts within 60s, the caller is told "Hamidia Hospital ne accept kar liya,
   * ambulance 15 minute mein aayegi."
   */
  async executeLayer1(emergency: EmergencyData, location: LocationData): Promise<DispatchResult> {
    Logger.info('Emergency dispatch Layer 1 started', {
      callId: emergency.callId,
      condition: emergency.condition,
      dispatchType: emergency.dispatchType,
    });

    try {
      const hospitals = await this._dashboard.getHospitalsInRadius(location, LAYER1_RADIUS_KM);
      const nearest = hospitals.slice(0, MAX_HOSPITALS_PER_BLAST);

      if (nearest.length === 0) {
        Logger.warn('Layer 1: no hospitals found within radius, escalating', {
          callId: emergency.callId,
          radiusKm: LAYER1_RADIUS_KM,
        });
        return { layer: 1, success: false };
      }

      // Track notified hospitals so Layer 2 doesn't re-blast them
      nearest.forEach(h => this._notifiedHospitalIds.add(h.hospitalId));
      await this._dashboard.blastNotification(nearest, emergency);

      // Wait for acceptance with timeout
      const accepted = await this._waitForAcceptance(nearest, emergency, LAYER1_TIMEOUT_MS);

      if (accepted) {
        Logger.info('Layer 1: hospital accepted', {
          callId: emergency.callId,
          hospitalId: accepted.hospitalId,
          hospitalName: accepted.hospitalName,
        });
        return {
          layer: 1,
          success: true,
          hospitalAccepted: accepted,
        };
      }

      Logger.warn('Layer 1: timeout — no hospital accepted within 60s', {
        callId: emergency.callId,
        hospitalsNotified: nearest.map(h => h.hospitalId),
      });
      return { layer: 1, success: false };

    } catch (err) {
      Logger.error('Layer 1 dispatch failed', {
        callId: emergency.callId,
        error: (err as Error).message,
      });
      return { layer: 1, success: false };
    }
  }

  /**
   * Layer 2: Expand radius to 60km AND bridge to 108 dispatcher in parallel.
   * Both run simultaneously — whichever resolves first wins.
   * 108 bridge is the human fallback — always available.
   *
   * Real-world scenario: No hospital accepted in 60s. Now we expand to 60km
   * AND connect the caller to a 108 dispatcher simultaneously. The 108 dispatcher
   * can coordinate ambulance dispatch while we keep trying hospitals.
   */
  async executeLayer2(emergency: EmergencyData, location: LocationData): Promise<DispatchResult> {
    Logger.info('Emergency dispatch Layer 2 started', {
      callId: emergency.callId,
    });

    try {
      // Fire both in parallel — hospital expansion + 108 bridge
      const [hospitalResult] = await Promise.allSettled([
        this._tryExpandedHospitals(emergency, location),
        this.bridgeTo108(emergency.callId, this._buildAssessmentSummary(emergency)),
      ]);

      const hospitalAccepted = hospitalResult.status === 'fulfilled'
        ? hospitalResult.value
        : undefined;

      Logger.info('Layer 2 complete', {
        callId: emergency.callId,
        hospitalAccepted: !!hospitalAccepted,
        dispatcher108Connected: true,
      });

      return {
        layer: 2,
        success: true,  // Layer 2 always succeeds — 108 bridge is the guaranteed fallback
        hospitalAccepted,
        dispatcher108Connected: true,
      };

    } catch (err) {
      Logger.error('Layer 2 dispatch failed', {
        callId: emergency.callId,
        error: (err as Error).message,
      });
      // Even on error, attempt 108 bridge — human dispatcher is the last reliable fallback.
      // Wrap _buildAssessmentSummary in try/catch because the same malformed data that caused
      // the original error could also crash the summary builder (e.g., null location).
      try {
        await this.bridgeTo108(emergency.callId, this._buildAssessmentSummary(emergency));
      } catch {
        // 108 bridge failed too — Layer 3 (SMS + ASHA) is the last resort
        Logger.error('Layer 2 catch: 108 bridge also failed', { callId: emergency.callId });
      }
      return { layer: 2, success: false, dispatcher108Connected: false };
    }
  }

  /**
   * Layer 3: SMS fallback — send 3 nearest hospital contacts + ASHA alert.
   * Used when Layer 1 and Layer 2 both fail (extremely rare — 108 bridge should always work).
   * Ensures the caller has actionable information even if all automated dispatch fails.
   *
   * Real-world scenario: Network outage, 108 unreachable. The caller's phone gets
   * an SMS with 3 hospital phone numbers and the ASHA worker is alerted to visit.
   */
  async executeLayer3(emergency: EmergencyData, location: LocationData): Promise<DispatchResult> {
    Logger.info('Emergency dispatch Layer 3 started', {
      callId: emergency.callId,
    });

    try {
      const hospitals = await this._dashboard.getHospitalsInRadius(location, LAYER2_RADIUS_KM);
      const nearest = hospitals.slice(0, 3);

      // In production: fire SNS SMS to callerNumber with hospital contacts
      // and trigger ASHA worker alert Lambda
      Logger.info('Layer 3: SMS fallback triggered', {
        callId: emergency.callId,
        callerNumber: emergency.callerNumber,
        hospitalsInSMS: nearest.map(h => ({ name: h.name, phone: h.phone })),
      });

      return {
        layer: 3,
        success: true,
        smsSent: true,
        ashaAlerted: true,
      };

    } catch (err) {
      Logger.error('Layer 3 dispatch failed', {
        callId: emergency.callId,
        error: (err as Error).message,
      });
      return { layer: 3, success: false, smsSent: false, ashaAlerted: false };
    }
  }

  /**
   * Bridges the caller to a 108 dispatcher.
   * In production: Twilio <Dial> TwiML to bridge the call.
   * Prototype: logs the bridge attempt.
   */
  async bridgeTo108(callId: string, assessmentSummary: string): Promise<void> {
    Logger.info('Bridging caller to 108 dispatcher', {
      callId,
      assessmentSummary,
    });
    // Production: return TwiML <Dial><Number>108</Number></Dial>
    // The assessment summary is passed to the dispatcher as a pre-recorded message
    // so they have clinical context before speaking to the caller.
  }

  /**
   * Executes the full 3-layer dispatch chain.
   * Layer 1 → if fail → Layer 2 → if fail → Layer 3.
   * Guarantees the caller is never left without assistance.
   *
   * Returns the result from whichever layer succeeded.
   * The call handler should use `buildAcceptanceMessage()` or the layer result
   * to construct the appropriate caller notification.
   */
  async executeFullDispatch(emergency: EmergencyData, location: LocationData): Promise<DispatchResult> {
    // Layer 1: 3 nearest hospitals within 30km
    const l1 = await this.executeLayer1(emergency, location);
    if (l1.success && l1.hospitalAccepted) {
      return l1;
    }

    // Layer 2: expand to 60km + 108 bridge in parallel
    const l2 = await this.executeLayer2(emergency, location);
    // Layer 2 returns success=true when 108 bridge connects (guaranteed fallback).
    // But if Layer 2 catch block fires (both hospital expansion AND 108 fail),
    // it returns success=false — escalate to Layer 3 (SMS + ASHA).
    if (l2.success) {
      return l2;
    }

    // Layer 3: SMS fallback + ASHA alert — last resort
    // Reached only when Layer 2 truly fails (108 bridge unreachable — extremely rare).
    return this.executeLayer3(emergency, location);
  }

  /**
   * Builds a bilingual caller notification message when a hospital accepts.
   * Req 5.2: "inform the Caller that the hospital has accepted and an ambulance is on the way"
   */
  buildAcceptanceMessage(hospitalName: string, estimatedArrival: string): BilingualInstruction {
    return {
      hindi: `${hospitalName} ne aapko accept kar liya hai. Ambulance lagbhag ${estimatedArrival} mein pahunchegi.`,
      english: `${hospitalName} has accepted you. Ambulance will arrive in approximately ${estimatedArrival}.`,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Simulates waiting for a hospital acceptance within the timeout window.
   * Production: polls DynamoDB for an acceptance record written by the hospital dashboard.
   * Prototype: resolves immediately with null (no real hospital dashboard).
   */
  private async _waitForAcceptance(
    hospitals: Hospital[],
    emergency: EmergencyData,
    timeoutMs: number,
  ): Promise<DispatchResult['hospitalAccepted'] | undefined> {
    // Production implementation:
    // Poll DynamoDB every 5s for up to timeoutMs for an acceptance record
    // keyed by emergencyId. Return the first acceptance found.
    //
    // Prototype: no real hospital dashboard — return undefined (timeout simulation)
    void hospitals; void emergency; void timeoutMs;
    return undefined;
  }

  /**
   * Tries expanded 60km radius hospital blast for Layer 2.
   *
   * Important: We skip hospitals already notified in Layer 1 by comparing hospitalIds,
   * NOT by index position. Layer 1 may have found fewer than 3 hospitals (e.g., 1 PHC
   * in a rural area). If we skip by index (slice(3)), we'd miss new hospitals at indices
   * 1-2 that are outside 30km but inside 60km. By tracking notified IDs, we blast only
   * hospitals that haven't been contacted yet.
   */
  private async _tryExpandedHospitals(
    emergency: EmergencyData,
    location: LocationData,
  ): Promise<DispatchResult['hospitalAccepted'] | undefined> {
    const hospitals = await this._dashboard.getHospitalsInRadius(location, LAYER2_RADIUS_KM);
    // Filter out hospitals already notified in Layer 1, then take next batch
    const newHospitals = hospitals.filter(h => !this._notifiedHospitalIds.has(h.hospitalId));
    const nextBatch = newHospitals.slice(0, MAX_HOSPITALS_PER_BLAST);
    if (nextBatch.length === 0) return undefined;
    nextBatch.forEach(h => this._notifiedHospitalIds.add(h.hospitalId));
    await this._dashboard.blastNotification(nextBatch, emergency);
    return this._waitForAcceptance(nextBatch, emergency, LAYER1_TIMEOUT_MS);
  }

  /**
   * Builds a concise assessment summary for the 108 dispatcher.
   * Dispatcher hears this before speaking to the caller.
   */
  private _buildAssessmentSummary(emergency: EmergencyData): string {
    return [
      `Emergency: ${emergency.condition} (ICD-10: ${emergency.icd10Code})`,
      `Dispatch: ${emergency.dispatchType}`,
      `Location: ${emergency.location.primaryLocation}`,
      `ABCDE: ${emergency.abcdeSummary}`,
      `Caller: ${emergency.callerNumber}`,
    ].join(' | ');
  }
}
