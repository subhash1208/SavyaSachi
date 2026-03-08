import { TriageResult, LocationData, ActionResults, PatientSummary, CallRecord } from '../models/types';
import { IActionOrchestrator } from '../interfaces/IActionOrchestrator';
import { ISmsService } from '../interfaces/ISmsService';
import { IReferralAgent } from '../interfaces/IReferralAgent';
import { IFollowUpScheduler } from '../interfaces/IFollowUpScheduler';
import { IASHAWorkerAgent } from '../interfaces/IASHAWorkerAgent';
import { IChronicCareAgent } from '../interfaces/IChronicCareAgent';
import { FacilityLevel } from '../models/enums';
import { Logger } from '../utils/logger';

/**
 * Lightweight interface for writing surveillance records per-call.
 * The Action Orchestrator writes one record per triage result.
 * The DiseaseSurveillanceService reads these records in batch (EventBridge cron).
 * Optional — if not provided, surveillance logging is a no-op (backward compatible).
 */
export interface ISurveillanceLogger {
  logTriageForSurveillance(record: {
    callId: string;
    icd10Code: string;
    district: string;
    state: string;
    village?: string;
    timestamp: string;
  }): Promise<void>;
}

// ─── Action Orchestrator ─────────────────────────────────────────────────────
// Req 7.6: Execute all post-triage actions in parallel using Promise.allSettled.
// This mirrors the AWS Step Functions parallel execution pattern.
//
// Actions triggered:
//   1. SMS triage summary to caller (Req 7.1)
//   2. Referral facility lookup (Req 7.4) — only if care level > home
//   3. Follow-up scheduling (Req 7.2) — only if followUpRequired
//   4. ASHA worker alert (Req 7.5) — only if ashaAlertRequired
//   5. Surveillance logging — always (writes to DynamoDB for batch spike detection)
//
// Emergency dispatch is NOT triggered here — it's handled by the call handler
// before the Action Orchestrator runs (dispatch must happen during the call,
// not after triage completes).

export class ActionOrchestratorService implements IActionOrchestrator {

  constructor(
    private readonly _sms: ISmsService,
    private readonly _referral: IReferralAgent,
    private readonly _followUp: IFollowUpScheduler,
    private readonly _asha: IASHAWorkerAgent,
    private readonly _surveillanceLogger?: ISurveillanceLogger,
    private readonly _chronicCare?: IChronicCareAgent,
  ) {}

  /**
   * Orchestrates all post-triage actions in parallel.
   * Uses Promise.allSettled so one failure doesn't block others.
   *
   * Real-world scenario: After triaging a child with diarrhea as non-urgent:
   *   - SMS sent to mother with ORS recipe + danger signs
   *   - Nearest PHC identified and included in SMS
   *   - 2-hour follow-up scheduled to check if child is improving
   *   - ASHA worker alerted if the village has one assigned
   *   - Call logged for disease surveillance
   * All 5 actions fire simultaneously — total time = slowest action (~200ms).
   *
   * Req 7.6: Parallel execution of all post-triage actions.
   */
  async orchestrateActions(triageResult: TriageResult, location: LocationData, callerNumber: string): Promise<ActionResults> {
    const results: ActionResults = {
      smsSent: false,
      ashaAlerted: false,
      followUpScheduled: false,
      surveillanceLogged: false,
    };

    // Phase 1: Referral lookup FIRST — SMS needs the facility info.
    // DynamoDB GetItem is ~5ms, so this doesn't meaningfully delay the pipeline.
    // Without this sequencing, SMS and referral run in parallel and the SMS
    // never includes the "Nearest Facility" section (race condition).
    if (triageResult.recommendedCareLevel !== 'home') {
      await this._findReferral(triageResult, location, results);
      // Attach facility to triageResult so SMS can include it
      if (results.referralFacility) {
        triageResult = { ...triageResult, referralFacility: results.referralFacility };
      }
    }

    // Phase 2: All remaining actions in parallel
    const actions: Array<Promise<void>> = [];

    // 1. SMS triage summary — always (now includes referral facility if found)
    actions.push(
      this._sendSms(triageResult, callerNumber, results)
    );

    // 2. Emergency hospital SMS — for emergency callers, send hospital contact list
    if (triageResult.isEmergency && results.referralFacility) {
      actions.push(
        this._sendEmergencyHospitalSms(callerNumber, results)
      );
    }

    // 3. Follow-up scheduling — only if required
    if (triageResult.followUpRequired && triageResult.followUpInterval) {
      actions.push(
        this._scheduleFollowUp(triageResult, results)
      );
    }

    // 4. ASHA worker alert — only if required
    if (triageResult.ashaAlertRequired) {
      actions.push(
        this._alertAsha(triageResult, location, results)
      );
    }

    // 5. Surveillance logging — always
    actions.push(
      this._logSurveillance(triageResult, location, results)
    );

    // 6. Chronic care enrollment — only if triage flagged a chronic condition
    if (triageResult.chronicCareEnrollment && this._chronicCare) {
      actions.push(
        this._enrollChronicCare(triageResult, location, callerNumber, results)
      );
    }

    // Fire all in parallel — allSettled ensures no single failure blocks others
    await Promise.allSettled(actions);

    Logger.info('Action orchestration complete', {
      callId: triageResult.callId,
      smsSent: results.smsSent,
      referral: !!results.referralFacility,
      followUp: results.followUpScheduled,
      asha: results.ashaAlerted,
      surveillance: results.surveillanceLogged,
      chronicCare: results.chronicCareEnrolled ?? false,
    });

    return results;
  }

  // ─── Private action wrappers ─────────────────────────────────────────────
  // Each wrapper catches its own errors so Promise.allSettled always resolves.

  private async _sendSms(
    triageResult: TriageResult,
    callerNumber: string,
    results: ActionResults,
  ): Promise<void> {
    try {
      await this._sms.sendTriageSummary(callerNumber, triageResult);
      // SMS service silently skips landline callers (returns void, no throw).
      // We detect landline here to avoid marking smsSent=true when no SMS was delivered.
      // This keeps ActionResults honest for analytics (QuickSight SMS delivery rate).
      results.smsSent = !this._isLandline(callerNumber);
    } catch (err) {
      Logger.error('SMS action failed in orchestrator', {
        callId: triageResult.callId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Landline detection — mirrors SmsService._isLandline().
   * Duplicated here because the orchestrator needs to know whether SMS
   * was actually delivered (for ActionResults accuracy), but the ISmsService
   * interface returns void (can't signal "skipped" vs "sent").
   */
  private _isLandline(phoneNumber: string): boolean {
    if (phoneNumber.startsWith('0')) return true;
    const match = phoneNumber.match(/^\+91(\d)/);
    if (match) {
      const subscriberDigit = parseInt(match[1], 10);
      return subscriberDigit >= 1 && subscriberDigit <= 5;
    }
    return false;
  }

  /**
   * Sends emergency hospital contact list SMS to the caller.
   * This is separate from the triage summary — emergency callers get BOTH:
   *   1. Triage summary with treatment instructions
   *   2. Hospital list with names, addresses, phone numbers, distances
   *
   * Real-world scenario: A snakebite victim's family receives two SMSes:
   *   - Triage summary: "Do NOT apply tourniquet, keep limb immobilized..."
   *   - Hospital list: "District Hospital Bhopal (12.3 km), Phone: 0755-..."
   */
  private async _sendEmergencyHospitalSms(
    callerNumber: string,
    results: ActionResults,
  ): Promise<void> {
    try {
      // Build a hospital list from the referral facility
      // In production, this would query getHospitalsInRadius for multiple hospitals
      if (results.referralFacility) {
        const hospital = {
          hospitalId: results.referralFacility.facilityId,
          name: results.referralFacility.name,
          address: results.referralFacility.address,
          phone: results.referralFacility.phone,
          location: { latitude: 0, longitude: 0 },
          facilityLevel: results.referralFacility.facilityLevel,
          distanceKm: results.referralFacility.distanceKm,
        };
        await this._sms.sendEmergencyInfo(callerNumber, [hospital]);
      }
    } catch (err) {
      // Non-blocking — triage summary SMS is the primary, this is supplementary
      Logger.error('Emergency hospital SMS failed', {
        error: (err as Error).message,
      });
    }
  }

  private async _findReferral(
    triageResult: TriageResult,
    location: LocationData,
    results: ActionResults,
  ): Promise<void> {
    try {
      const requiredLevel = this._careLevelToFacilityLevel(triageResult.recommendedCareLevel);
      const facility = await this._referral.findNearestFacility(location, requiredLevel);
      results.referralFacility = facility;
    } catch (err) {
      Logger.error('Referral action failed in orchestrator', {
        callId: triageResult.callId,
        error: (err as Error).message,
      });
    }
  }

  private async _scheduleFollowUp(
    triageResult: TriageResult,
    results: ActionResults,
  ): Promise<void> {
    try {
      const purpose = triageResult.isEmergency ? 'post_emergency' as const : 'acute_check' as const;
      const scheduleId = await this._followUp.scheduleFollowUp(
        triageResult.callId,
        triageResult.followUpInterval!,
        purpose,
      );
      results.followUpScheduled = scheduleId !== '';
    } catch (err) {
      Logger.error('Follow-up action failed in orchestrator', {
        callId: triageResult.callId,
        error: (err as Error).message,
      });
    }
  }

  private async _alertAsha(
    triageResult: TriageResult,
    location: LocationData,
    results: ActionResults,
  ): Promise<void> {
    try {
      const patientSummary: PatientSummary = {
        callId: triageResult.callId,
        conditionId: triageResult.condition,
        icd10Code: triageResult.icd10Code,
        severity: triageResult.severity,
        location,
        // For emergencies, include up to 3 treatment instructions so the ASHA worker
        // gets critical first-aid guidance (e.g., snakebite: immobilize + no tourniquet + no cutting).
        // For non-emergencies, first instruction is sufficient (e.g., "ORS recipe").
        treatmentSummaryHindi: this._buildTreatmentSummary(triageResult),
      };

      await this._asha.alertASHAWorker(location, patientSummary);
      results.ashaAlerted = true;
    } catch (err) {
      Logger.error('ASHA alert action failed in orchestrator', {
        callId: triageResult.callId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Writes a lightweight surveillance record for this call.
   * The DiseaseSurveillanceService reads these records later in batch
   * (EventBridge cron) for spike detection.
   *
   * If no ISurveillanceLogger was injected (e.g., in unit tests or
   * before Task 13 wiring), this is a no-op that always succeeds.
   */
  private async _logSurveillance(
    triageResult: TriageResult,
    location: LocationData,
    results: ActionResults,
  ): Promise<void> {
    if (!this._surveillanceLogger) {
      results.surveillanceLogged = true;
      return;
    }

    try {
      await this._surveillanceLogger.logTriageForSurveillance({
        callId: triageResult.callId,
        icd10Code: triageResult.icd10Code,
        district: location.tier2Phone.district,
        state: location.tier2Phone.state,
        village: location.tier1Voice?.village,
        timestamp: new Date().toISOString(),
      });
      results.surveillanceLogged = true;
    } catch (err) {
      Logger.error('Surveillance logging failed in orchestrator', {
        callId: triageResult.callId,
        error: (err as Error).message,
      });
      // Non-blocking — surveillance failure doesn't affect patient care
    }
  }

  /**
   * Enrolls a chronic care patient and assigns an ASHA worker.
   *
   * Real-world scenario: Ramesh, 58, calls about excessive thirst and frequent
   * urination. Nova Pro triages → diabetes (non-urgent). The orchestrator fires
   * this action in parallel with SMS, follow-up, and surveillance. The ASHA worker
   * in Ramesh's village gets an SMS with a weekly blood sugar checklist.
   *
   * Req 11.1: Chronic care enrollment with ASHA assignment.
   */
  private async _enrollChronicCare(
    triageResult: TriageResult,
    location: LocationData,
    callerNumber: string,
    results: ActionResults,
  ): Promise<void> {
    if (!this._chronicCare || !triageResult.chronicCareEnrollment) return;

    try {
      // Build a minimal CallRecord from what the orchestrator has.
      // The full CallRecord is assembled by the call handler (Task 16) —
      // here we use the triage result fields to construct what enrollPatient needs.
      const callRecord: CallRecord = {
        callId: triageResult.callId,
        timestamp: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
        callerNumber,
        callSourceType: 'unknown',
        language: 'hindi',
        duration: 0,
        triageOutcome: 'general_triage_complete',
        conditionId: triageResult.condition,
        icd10Code: triageResult.icd10Code,
        severityClassification: triageResult.severity,
        dispatchType: triageResult.dispatchType,
        actionsTaken: ['chronic_enrollment'],
        location,
        recordingS3Key: '',
        bedrockTraceId: '',
        fhirRecord: {
          resourceType: 'Condition',
          code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: triageResult.icd10Code, display: triageResult.condition }] },
          recordedDate: new Date().toISOString(),
          severity: { coding: [{ system: 'http://snomed.info/sct', code: '6736007', display: triageResult.severity }] },
        },
      };

      await this._chronicCare.enrollPatient(callRecord, triageResult.chronicCareEnrollment);
      results.chronicCareEnrolled = true;

      Logger.info('Chronic care enrollment completed via orchestrator', {
        callId: triageResult.callId,
        condition: triageResult.chronicCareEnrollment,
      });
    } catch (err) {
      Logger.error('Chronic care enrollment failed in orchestrator', {
        callId: triageResult.callId,
        condition: triageResult.chronicCareEnrollment,
        error: (err as Error).message,
      });
      // Non-blocking — enrollment failure doesn't affect other actions
    }
  }

  /**
   * Maps TriageResult.recommendedCareLevel to FacilityLevel enum.
   * "home" should never reach here (filtered by caller), but defaults to PHC.
   */
  _careLevelToFacilityLevel(careLevel: TriageResult['recommendedCareLevel']): FacilityLevel {
    switch (careLevel) {
      case 'PHC': return 'PHC';
      case 'CHC': return 'CHC';
      case 'district_hospital': return 'district_hospital';
      case 'home':
      default:
        return 'PHC';
    }
  }

  /**
   * Builds a Hindi treatment summary for the ASHA worker alert.
   * Emergency cases get up to 3 instructions (critical first-aid steps).
   * Non-emergency cases get the first instruction only (sufficient context).
   * Fallback: generic "no specific instructions" message.
   */
  private _buildTreatmentSummary(triageResult: TriageResult): string {
    if (triageResult.treatmentAdvice.length === 0) {
      return 'कोई विशेष उपचार निर्देश नहीं';
    }

    if (triageResult.isEmergency) {
      // Emergency: include up to 3 instructions separated by semicolons
      const maxInstructions = Math.min(triageResult.treatmentAdvice.length, 3);
      return triageResult.treatmentAdvice
        .slice(0, maxInstructions)
        .map(a => a.hindi)
        .join('; ');
    }

    return triageResult.treatmentAdvice[0].hindi;
  }
}
