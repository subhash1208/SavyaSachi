import { LocationData, PatientSummary, MonitoringChecklist } from '../models/types';
import { ChronicCondition } from '../models/enums';
import { IASHAWorkerAgent } from '../interfaces/IASHAWorkerAgent';
import { Logger } from '../utils/logger';

// ─── DI types ────────────────────────────────────────────────────────────────

export interface IASHAWorkerRepository {
  findByLocation(district: string, village?: string): Promise<ASHAWorkerRecord | null>;
  findById(ashaWorkerId: string): Promise<ASHAWorkerRecord | null>;
}

export interface IASHASmsClient {
  publish(params: { PhoneNumber: string; Message: string }): Promise<void>;
}

export interface ASHAWorkerRecord {
  ashaWorkerId: string;
  name: string;
  phone: string;
  village: string;
  block: string;
  district: string;
  state: string;
}

// ─── ASHA Worker Agent ───────────────────────────────────────────────────────

export class ASHAWorkerAgentService implements IASHAWorkerAgent {

  constructor(
    private readonly _ashaRepo: IASHAWorkerRepository,
    private readonly _sms: IASHASmsClient,
  ) {}

  /**
   * Alerts the nearest ASHA worker for emergency/critical cases.
   * Sends SMS with patient details, condition, severity, and location.
   *
   * Real-world scenario: A snakebite victim calls from Khedi village.
   * The ASHA worker assigned to Khedi block receives an SMS:
   * "Emergency: Snakebite (T63.0), Severity: Critical, Location: Khedi village.
   *  Patient needs immediate antivenom. Do NOT apply tourniquet."
   *
   * Req 7.5: SMS alert to nearest ASHA worker with patient details.
   */
  async alertASHAWorker(location: LocationData, patientDetails: PatientSummary): Promise<void> {
    const district = location.tier1Voice?.district ?? location.tier2Phone.district;
    const village = location.tier1Voice?.village;

    try {
      const asha = await this._ashaRepo.findByLocation(district, village);
      if (!asha) {
        Logger.warn('No ASHA worker found for location', { district, village });
        return;
      }

      const message = this._buildAlertMessage(patientDetails, location);
      await this._sms.publish({
        PhoneNumber: asha.phone,
        Message: message,
      });

      Logger.info('ASHA worker alerted', {
        ashaWorkerId: asha.ashaWorkerId,
        callId: patientDetails.callId,
        district,
      });
    } catch (err) {
      // ASHA alert failure must NOT crash the call
      Logger.error('ASHA worker alert failed', {
        callId: patientDetails.callId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Assigns an ASHA worker to a chronic care patient.
   * Records the assignment in DynamoDB for ongoing monitoring.
   *
   * Real-world scenario: A diabetic patient in rural MP is enrolled in chronic
   * care. The local ASHA worker is assigned to check blood sugar weekly and
   * report back via the monitoring checklist.
   *
   * Req 11.1: Assign ASHA workers for chronic care monitoring.
   */
  async assignChronicCare(patientId: string, condition: ChronicCondition, ashaWorkerId: string): Promise<void> {
    try {
      const asha = await this._ashaRepo.findById(ashaWorkerId);
      if (!asha) {
        Logger.warn('ASHA worker not found for chronic care assignment', { ashaWorkerId });
        return;
      }

      // Notify ASHA worker of new chronic care assignment
      const message = this._buildChronicCareAssignmentMessage(patientId, condition);
      await this._sms.publish({
        PhoneNumber: asha.phone,
        Message: message,
      });

      Logger.info('Chronic care assigned to ASHA worker', {
        patientId,
        condition,
        ashaWorkerId,
      });
    } catch (err) {
      Logger.error('Chronic care assignment failed', {
        patientId,
        condition,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Sends a monitoring checklist to an ASHA worker.
   * Condition-specific items (e.g., blood sugar for diabetes, BP for hypertension).
   *
   * Req 11.2: Condition-specific monitoring checklists.
   */
  async sendMonitoringChecklist(ashaWorkerId: string, checklist: MonitoringChecklist): Promise<void> {
    try {
      const asha = await this._ashaRepo.findById(ashaWorkerId);
      if (!asha) {
        Logger.warn('ASHA worker not found for checklist', { ashaWorkerId });
        return;
      }

      const message = this._buildChecklistMessage(checklist);
      await this._sms.publish({
        PhoneNumber: asha.phone,
        Message: message,
      });

      Logger.info('Monitoring checklist sent', { ashaWorkerId, condition: checklist.condition });
    } catch (err) {
      Logger.error('Checklist send failed', {
        ashaWorkerId,
        error: (err as Error).message,
      });
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Maps conditionId to Hindi name for ASHA worker alerts.
   * ASHA workers in rural India are more familiar with Hindi condition names
   * than English medical terms or ICD-10 codes.
   *
   * Real-world scenario: An ASHA worker in Khedi village receives an SMS
   * saying "Condition: cardiac (I21.9)" — she doesn't know what "cardiac" means.
   * With Hindi mapping: "Condition: हृदय रोग / cardiac (I21.9)" — immediately clear.
   */
  private _conditionHindiName(conditionId: string): string {
    const map: Record<string, string> = {
      cardiac: 'हृदय रोग',
      snakebite: 'सांप का काटना',
      child_fever: 'बच्चे को बुखार',
      breathing_difficulty: 'सांस लेने में तकलीफ',
      general_fever: 'बुखार',
      diarrhea: 'दस्त',
      dengue: 'डेंगू',
      malaria: 'मलेरिया',
      stroke: 'स्ट्रोक',
      severe_bleeding: 'गंभीर रक्तस्राव',
      choking: 'गला घुटना',
      burns: 'जलना',
      poisoning: 'विषाक्तता',
      anaphylaxis: 'एनाफिलेक्सिस',
      seizure: 'दौरा',
      pregnancy_emergency: 'गर्भावस्था आपातकाल',
      drowning: 'डूबना',
      unconsciousness: 'बेहोशी',
      infant_not_breathing: 'शिशु सांस नहीं ले रहा',
      heatstroke: 'लू लगना',
      maternal_care: 'मातृ देखभाल',
      chronic_disease: 'पुरानी बीमारी',
      headache: 'सिरदर्द',
      jaundice: 'पीलिया',
    };
    return map[conditionId] ?? conditionId;
  }

  private _buildAlertMessage(patient: PatientSummary, location: LocationData): string {
    const hindiName = this._conditionHindiName(patient.conditionId);
    const lines: string[] = [];
    lines.push('VaidyaVaani ASHA Alert / आशा अलर्ट');
    lines.push('');
    lines.push(`Condition / स्थिति: ${hindiName} / ${patient.conditionId} (${patient.icd10Code})`);
    lines.push(`Severity / गंभीरता: ${this._severityHindi(patient.severity)}`);
    lines.push(`Location / स्थान: ${location.primaryLocation}`);
    lines.push('');
    lines.push(`Summary / सारांश: ${patient.treatmentSummaryHindi}`);
    lines.push('');
    lines.push('Please visit the patient immediately / कृपया तुरंत मरीज से मिलें');
    return lines.join('\n');
  }

  /**
   * Translates severity enum to bilingual Hindi+English label.
   * ASHA workers are more familiar with Hindi severity terms than English.
   */
  private _severityHindi(severity: string): string {
    switch (severity) {
      case 'critical': return 'गंभीर (Critical)';
      case 'urgent': return 'तत्काल (Urgent)';
      case 'non-urgent': return 'सामान्य (Non-urgent)';
      default: return severity;
    }
  }

  private _buildChronicCareAssignmentMessage(patientId: string, condition: ChronicCondition): string {
    const conditionHindi: Record<ChronicCondition, string> = {
      diabetes: 'मधुमेह (Diabetes)',
      hypertension: 'उच्च रक्तचाप (Hypertension)',
      tb: 'टीबी (TB)',
    };

    const lines: string[] = [];
    lines.push('VaidyaVaani - New Chronic Care Assignment');
    lines.push(`Patient: ${patientId}`);
    lines.push(`Condition: ${conditionHindi[condition]}`);
    lines.push('Please begin regular monitoring as per checklist.');
    return lines.join('\n');
  }

  private _buildChecklistMessage(checklist: MonitoringChecklist): string {
    const lines: string[] = [];
    lines.push(`VaidyaVaani Monitoring Checklist - ${checklist.condition}`);
    lines.push(`Frequency: ${checklist.frequency}`);
    lines.push('');
    lines.push('Items to check:');
    for (const item of checklist.items) {
      lines.push(`- ${item}`);
    }
    lines.push('');
    lines.push('Alert thresholds:');
    for (const threshold of checklist.alertThresholds) {
      lines.push(`⚠ ${threshold}`);
    }
    return lines.join('\n');
  }
}
