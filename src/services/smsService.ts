import { TriageResult, Hospital } from '../models/types';
import { SeverityLevel } from '../models/enums';
import { ISmsService } from '../interfaces/ISmsService';
import { Logger } from '../utils/logger';

// ─── SNS client type for DI ──────────────────────────────────────────────────

export interface ISNSClient {
  publish(params: { PhoneNumber: string; Message: string }): Promise<void>;
}

// ─── SMS Service ─────────────────────────────────────────────────────────────

export class SmsService implements ISmsService {

  constructor(private readonly _sns: ISNSClient) {}

  /**
   * Sends a triage summary SMS to the caller after triage is complete.
   * Content includes: condition, severity, treatment instructions, next steps.
   * Bilingual (Hindi + English) to match caller's language register.
   *
   * Landline callers cannot receive SMS — detected by phone number pattern.
   * Indian landlines: 0 + STD code (2-4 digits) + local number (6-8 digits).
   * Mobile numbers: +91 followed by 10 digits starting with 6-9.
   * If the caller is on a landline, we log a warning and skip SMS gracefully.
   *
   * Real-world scenario: A mother calls about her child's diarrhea. After triage,
   * she receives an SMS with ORS preparation recipe, danger signs to watch for,
   * and the nearest PHC address — all in Hindi + English.
   *
   * Req 7.1: SMS with triage outcome, treatment instructions, next steps.
   */
  async sendTriageSummary(phoneNumber: string, triageResult: TriageResult): Promise<void> {
    if (this._isLandline(phoneNumber)) {
      Logger.warn('SMS skipped — caller is on landline', {
        callId: triageResult.callId,
        phoneNumber,
      });
      return;
    }

    const message = this._buildTriageSmsContent(triageResult);

    try {
      await this._sns.publish({
        PhoneNumber: phoneNumber,
        Message: message,
      });
      Logger.info('Triage summary SMS sent', { callId: triageResult.callId, phoneNumber });
    } catch (err) {
      // SMS failure must NOT crash the call or block other post-triage actions
      Logger.error('Failed to send triage summary SMS', {
        callId: triageResult.callId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Sends emergency hospital info SMS — used by Layer 3 fallback.
   * Lists nearest hospitals with name, address, phone.
   * Landline callers are skipped (same as sendTriageSummary).
   *
   * Req 5.5 / 7.1: SMS fallback with nearest 3 hospitals' contact details.
   */
  async sendEmergencyInfo(phoneNumber: string, hospitals: Hospital[]): Promise<void> {
    if (this._isLandline(phoneNumber)) {
      Logger.warn('Emergency SMS skipped — caller is on landline', { phoneNumber });
      return;
    }
    const message = this._buildEmergencyHospitalSms(hospitals);

    try {
      await this._sns.publish({
        PhoneNumber: phoneNumber,
        Message: message,
      });
      Logger.info('Emergency hospital info SMS sent', { phoneNumber, hospitalCount: hospitals.length });
    } catch (err) {
      Logger.error('Failed to send emergency hospital SMS', {
        error: (err as Error).message,
      });
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Maximum SMS character length. SNS supports up to 1600 chars for
   * multi-part SMS, but Indian carriers sometimes truncate at ~1000.
   * We cap at 1500 chars and append a footer directing callers to 108.
   *
   * Real-world scenario: A patient with 8 treatment instructions (ORS recipe,
   * danger signs, medication schedule, diet, hydration, rest, follow-up, referral)
   * could generate a 2000+ char SMS. Without truncation, the tail gets silently
   * dropped by the carrier — the caller loses the referral facility info.
   */
  private static readonly SMS_MAX_CHARS = 1500;
  private static readonly SMS_TRUNCATION_FOOTER = '\n...\nCall 108 for full details / पूरी जानकारी के लिए 108 पर कॉल करें';

  /**
   * Builds bilingual triage summary SMS content.
   * Includes: condition, severity, treatment advice, care level, follow-up info.
   * Truncates at SMS_MAX_CHARS to prevent carrier-level silent truncation.
   */
  private _buildTriageSmsContent(triageResult: TriageResult): string {
    const lines: string[] = [];

    // Header
    lines.push('VaidyaVaani - Triage Summary / जांच सारांश');
    lines.push('');

    // Condition + severity
    lines.push(`Condition / स्थिति: ${triageResult.condition}`);
    lines.push(`Severity / गंभीरता: ${this._severityHindi(triageResult.severity)}`);
    lines.push(`ICD-10: ${triageResult.icd10Code}`);
    lines.push('');

    // Treatment instructions (bilingual)
    if (triageResult.treatmentAdvice.length > 0) {
      lines.push('Treatment / उपचार:');
      for (const advice of triageResult.treatmentAdvice) {
        lines.push(`- ${advice.hindi}`);
        lines.push(`  ${advice.english}`);
      }
      lines.push('');
    }

    // Care level recommendation
    lines.push(`Care Level / देखभाल स्तर: ${this._careLevelHindi(triageResult.recommendedCareLevel)}`);

    // Dispatch info — critical for emergency callers to know help is coming
    if (triageResult.isEmergency && triageResult.dispatchType !== 'none') {
      lines.push('');
      lines.push(`🚑 Ambulance dispatched (${triageResult.dispatchType}) / एम्बुलेंस भेजी गई (${triageResult.dispatchType})`);
    }

    // Referral facility if present
    if (triageResult.referralFacility) {
      lines.push('');
      lines.push('Nearest Facility / निकटतम सुविधा:');
      lines.push(`  ${triageResult.referralFacility.name}`);
      lines.push(`  ${triageResult.referralFacility.address}`);
      if (triageResult.referralFacility.phone) {
        lines.push(`  Phone: ${triageResult.referralFacility.phone}`);
      }
    }

    // Follow-up info
    if (triageResult.followUpRequired && triageResult.followUpInterval) {
      lines.push('');
      lines.push(`Follow-up / अनुवर्ती: ${triageResult.followUpInterval} में कॉल आएगी`);
    }

    const raw = lines.join('\n');

    // Truncation guard: if SMS exceeds carrier-safe limit, truncate and add footer
    if (raw.length > SmsService.SMS_MAX_CHARS) {
      const truncateAt = SmsService.SMS_MAX_CHARS - SmsService.SMS_TRUNCATION_FOOTER.length;
      return raw.substring(0, truncateAt) + SmsService.SMS_TRUNCATION_FOOTER;
    }

    return raw;
  }

  /**
   * Builds emergency hospital list SMS for Layer 3 fallback.
   */
  private _buildEmergencyHospitalSms(hospitals: Hospital[]): string {
    const lines: string[] = [];
    lines.push('VaidyaVaani - Emergency / आपातकालीन');
    lines.push('Nearest hospitals / निकटतम अस्पताल:');
    lines.push('');

    for (const h of hospitals) {
      lines.push(`${h.name}`);
      lines.push(`  ${h.address}`);
      lines.push(`  Phone: ${h.phone}`);
      if (h.distanceKm !== undefined) {
        lines.push(`  Distance: ${h.distanceKm.toFixed(1)} km`);
      }
      lines.push('');
    }

    lines.push('Call 108 for ambulance / एम्बुलेंस के लिए 108 डायल करें');
    return lines.join('\n');
  }

  private _severityHindi(severity: SeverityLevel): string {
    switch (severity) {
      case 'critical': return 'गंभीर (Critical)';
      case 'urgent': return 'तत्काल (Urgent)';
      case 'non-urgent': return 'सामान्य (Non-urgent)';
      default: return severity;
    }
  }

  private _careLevelHindi(level: TriageResult['recommendedCareLevel']): string {
    switch (level) {
      case 'home': return 'घर पर देखभाल (Home care)';
      case 'PHC': return 'प्राथमिक स्वास्थ्य केंद्र (PHC)';
      case 'CHC': return 'सामुदायिक स्वास्थ्य केंद्र (CHC)';
      case 'district_hospital': return 'जिला अस्पताल (District Hospital)';
      default: return level;
    }
  }

  /**
   * Detects if a phone number is a landline.
   * Indian landlines: start with 0 + STD code (2-4 digits) + local number.
   * Mobile numbers: +91 followed by 10 digits starting with 6-9.
   *
   * Heuristic: if the number starts with "0" (domestic landline prefix) or
   * if it's a +91 number where the subscriber digit (after +91) is 1-5,
   * it's likely a landline. Mobile subscribers always start with 6-9.
   *
   * Real-world scenario: A village sarpanch calls from the panchayat office
   * landline (0755-2550100). SMS would fail silently — better to skip and
   * log a warning so the ASHA worker alert becomes the primary notification.
   */
  _isLandline(phoneNumber: string): boolean {
    // Domestic format: 0XXXX-XXXXXX (starts with 0)
    if (phoneNumber.startsWith('0')) return true;

    // International format: +91 followed by subscriber digit
    // Mobile: +91[6-9]XXXXXXXXX — subscriber digit is 6, 7, 8, or 9
    // Landline: +91[1-5]X... — subscriber digit is 1-5 (STD code area)
    const match = phoneNumber.match(/^\+91(\d)/);
    if (match) {
      const subscriberDigit = parseInt(match[1], 10);
      return subscriberDigit >= 1 && subscriberDigit <= 5;
    }

    return false;
  }
}
