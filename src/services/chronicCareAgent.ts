import { CallRecord, ChronicCareEnrollment, MonitoringChecklist } from '../models/types';
import { ChronicCondition } from '../models/enums';
import { IChronicCareAgent } from '../interfaces/IChronicCareAgent';
import { IASHAWorkerRepository, IASHASmsClient } from './ashaWorkerAgent';
import { Logger } from '../utils/logger';

// ─── ICD-10 codes for chronic conditions ─────────────────────────────────────

const CHRONIC_ICD10: Record<ChronicCondition, string> = {
  diabetes: 'E11.9',     // Type 2 diabetes mellitus, unspecified — matches triageAgent.tagICD10('diabetes')
  hypertension: 'I10',   // Essential (primary) hypertension — matches triageAgent.tagICD10('hypertension')
  tb: 'A15.0',           // Respiratory tuberculosis — matches triageAgent.tagICD10('tb')
};

// ─── Monitoring schedules ─────────────────────────────────────────────────────

const MONITORING_SCHEDULE: Record<ChronicCondition, string> = {
  diabetes: 'Weekly blood sugar check, monthly HbA1c review',
  hypertension: 'Weekly BP monitoring, monthly medication review',
  tb: 'Daily medication observation (DOT), weekly symptom check',
};

// ─── Condition-specific monitoring checklists ─────────────────────────────────
//
// These are the structured checklists sent to ASHA workers via SMS.
// Items are bilingual (Hindi / English) so ASHA workers in rural India
// can read them without needing English literacy.
//
// Req 11.2: Condition-specific monitoring checklists.

const MONITORING_CHECKLISTS: Record<ChronicCondition, MonitoringChecklist> = {
  diabetes: {
    condition: 'diabetes',
    frequency: 'weekly',
    items: [
      'Fasting blood sugar check / खाली पेट रक्त शर्करा जांच',
      'Foot inspection for sores or numbness / पैरों में घाव या सुन्नपन की जांच',
      'Medication compliance check / दवाई नियमित ले रहे हैं?',
      'Diet review — avoiding sugar and white rice / खान-पान — चीनी और सफेद चावल से परहेज',
      'Weight check / वजन जांच',
    ],
    alertThresholds: [
      'Fasting blood sugar > 200 mg/dL → call VaidyaVaani immediately',
      'Fasting blood sugar < 70 mg/dL (hypoglycemia) → emergency',
      'Foot wound or ulcer present → refer to PHC',
      'Patient unconscious or confused → call 108',
    ],
  },

  hypertension: {
    condition: 'hypertension',
    frequency: 'weekly',
    items: [
      'Blood pressure measurement / रक्तचाप माप',
      'Medication compliance check / दवाई नियमित ले रहे हैं?',
      'Salt intake review / नमक कम खा रहे हैं?',
      'Headache or dizziness check / सिरदर्द या चक्कर?',
      'Chest pain or shortness of breath check / सीने में दर्द या सांस फूलना?',
    ],
    alertThresholds: [
      'Systolic BP > 180 mmHg → call VaidyaVaani immediately',
      'Diastolic BP > 120 mmHg → emergency',
      'Severe headache + blurred vision → call 108 (hypertensive crisis)',
      'Chest pain present → call 108 immediately',
    ],
  },

  tb: {
    condition: 'tb',
    frequency: 'daily',
    items: [
      'Medication taken today (DOT — Directly Observed Therapy) / आज दवाई ली? (DOT)',
      'Cough check — improving or worsening? / खांसी — सुधर रही है या बढ़ रही है?',
      'Fever check / बुखार जांच',
      'Weight check (weekly) / वजन जांच (साप्ताहिक)',
      'Side effects check — nausea, yellow eyes / दुष्प्रभाव — मतली, पीली आंखें',
    ],
    alertThresholds: [
      'Missed medication 2+ days → contact patient immediately',
      'Coughing blood (hemoptysis) → call 108',
      'Yellow eyes or skin (jaundice) → refer to district hospital',
      'High fever > 39°C for 3+ days → call VaidyaVaani',
    ],
  },
};

// ─── ChronicCareAgent ─────────────────────────────────────────────────────────

export class ChronicCareAgentService implements IChronicCareAgent {

  constructor(
    private readonly _ashaRepo: IASHAWorkerRepository,
    private readonly _sms: IASHASmsClient,
  ) {}

  /**
   * Enrolls a caller in the chronic care program.
   *
   * Steps:
   * 1. Resolve ICD-10 code for the condition
   * 2. Look up nearest ASHA worker by caller's location
   * 3. Build ChronicCareEnrollment record
   * 4. Notify ASHA worker via SMS with patient details + checklist
   * 5. Return enrollment record for DynamoDB persistence (caller's responsibility)
   *
   * Real-world scenario: Ramesh, 58, calls from Vidisha. Nova Pro detects
   * Type 2 diabetes. ChronicCareAgent enrolls him, assigns ASHA worker Sunita,
   * sends Sunita the weekly blood sugar checklist. Ramesh gets an SMS confirming
   * his enrollment and Sunita's name.
   *
   * Req 11.1: Enroll caller, assign nearest ASHA worker, send SMS with
   * patient details and condition-specific monitoring instructions.
   */
  async enrollPatient(callRecord: CallRecord, condition: ChronicCondition): Promise<ChronicCareEnrollment> {
    const icd10Code = CHRONIC_ICD10[condition];
    const district = callRecord.location.tier1Voice?.district
      ?? callRecord.location.tier2Phone.district;
    const village = callRecord.location.tier1Voice?.village;

    // Look up nearest ASHA worker — repo failure is non-fatal (enrollment still proceeds)
    let asha = null;
    try {
      asha = await this._ashaRepo.findByLocation(district, village);
    } catch (err) {
      Logger.error('ASHA worker lookup failed — enrolling without assignment', {
        district, village, condition, error: (err as Error).message,
      });
    }

    const enrollment: ChronicCareEnrollment = {
      patientId: callRecord.callId,          // callId doubles as patientId for enrollment
      callerNumber: callRecord.callerNumber,
      condition,
      icd10Code,
      assignedAshaWorkerId: asha?.ashaWorkerId ?? 'unassigned',
      assignedAshaWorkerPhone: asha?.phone ?? '',
      monitoringSchedule: MONITORING_SCHEDULE[condition],
      monitoringChecklist: MONITORING_CHECKLISTS[condition].items,
      enrollmentDate: new Date().toISOString(),
      location: callRecord.location,
    };

    // Notify ASHA worker of new enrollment + send checklist
    if (asha) {
      await this._notifyAshaWorker(asha.phone, enrollment, condition);
    } else {
      Logger.warn('No ASHA worker found for chronic care enrollment', { district, village, condition });
    }

    Logger.info('Chronic care enrollment created', {
      patientId: enrollment.patientId,
      condition,
      icd10Code,
      ashaWorkerId: enrollment.assignedAshaWorkerId,
      district,
    });

    return enrollment;
  }

  /**
   * Returns the condition-specific monitoring checklist items.
   *
   * Used by the call handler to include checklist in the caller's SMS
   * and by the ASHA worker agent to send structured monitoring instructions.
   *
   * Req 11.2: Condition-specific monitoring checklists.
   * - diabetes → blood sugar, foot inspection, medication compliance
   * - hypertension → BP monitoring, medication compliance, salt intake
   * - tb → DOT medication observation, cough check, side effects
   */
  getMonitoringChecklist(condition: ChronicCondition): string[] {
    return [...MONITORING_CHECKLISTS[condition].items];
  }

  /**
   * Returns the full MonitoringChecklist object (items + frequency + thresholds).
   * Used by ASHAWorkerAgentService.sendMonitoringChecklist().
   */
  getFullChecklist(condition: ChronicCondition): MonitoringChecklist {
    return MONITORING_CHECKLISTS[condition];
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Sends enrollment notification + checklist to the assigned ASHA worker.
   * Single SMS combining assignment + checklist to avoid SMS spam.
   */
  private async _notifyAshaWorker(
    ashaPhone: string,
    enrollment: ChronicCareEnrollment,
    condition: ChronicCondition,
  ): Promise<void> {
    try {
      const checklist = MONITORING_CHECKLISTS[condition];
      const conditionLabel = this._conditionLabel(condition);

      const lines: string[] = [];
      lines.push('VaidyaVaani - Chronic Care Assignment / पुरानी बीमारी देखभाल');
      lines.push('');
      lines.push(`Patient ID: ${enrollment.patientId}`);
      lines.push(`Condition / स्थिति: ${conditionLabel}`);
      lines.push(`ICD-10: ${enrollment.icd10Code}`);
      lines.push(`Schedule / समय: ${enrollment.monitoringSchedule}`);
      lines.push('');
      lines.push(`Checklist (${checklist.frequency}):`);
      for (const item of checklist.items) {
        lines.push(`- ${item}`);
      }
      lines.push('');
      lines.push('Alert thresholds / चेतावनी:');
      for (const threshold of checklist.alertThresholds) {
        lines.push(`⚠ ${threshold}`);
      }

      await this._sms.publish({ PhoneNumber: ashaPhone, Message: lines.join('\n') });
    } catch (err) {
      // SMS failure must NOT crash enrollment — enrollment record is still valid
      Logger.error('ASHA worker enrollment SMS failed', {
        patientId: enrollment.patientId,
        condition,
        error: (err as Error).message,
      });
    }
  }

  private _conditionLabel(condition: ChronicCondition): string {
    const labels: Record<ChronicCondition, string> = {
      diabetes: 'मधुमेह (Diabetes)',
      hypertension: 'उच्च रक्तचाप (Hypertension)',
      tb: 'टीबी (TB / Tuberculosis)',
    };
    return labels[condition];
  }
}
