export type Language =
  | "hindi" | "english" | "tamil" | "telugu" | "bengali"
  | "marathi" | "gujarati" | "kannada" | "malayalam" | "punjabi";

export type Voice = "arjun" | "kiara";

export type EmergencyCondition =
  | "cardiac" | "stroke" | "snakebite" | "severe_bleeding" | "choking"
  | "burns" | "poisoning" | "anaphylaxis" | "seizure" | "pregnancy_emergency"
  | "drowning" | "breathing_difficulty" | "unconsciousness"
  | "infant_not_breathing" | "heatstroke";

export type ChronicCondition = "diabetes" | "hypertension" | "tb";

export type FacilityLevel = "PHC" | "CHC" | "district_hospital";

export type ActionType =
  | "sms_treatment" | "dispatch_108" | "dispatch_102" | "hospital_dashboard"
  | "asha_alert" | "follow_up_scheduled" | "referral"
  | "chronic_enrollment" | "photo_requested";

export type CallPurpose = "follow_up" | "chronic_checkin" | "missed_call_callback";

export type FollowUpPurpose = "acute_check" | "chronic_monitoring" | "post_emergency";

export type DrugQueryType = "safety" | "dosage" | "overdose" | "availability";

export type SeverityLevel = "critical" | "urgent" | "non-urgent";

export type TriageOutcome =
  | "emergency_dispatched" | "general_triage_complete" | "drug_query_resolved"
  | "referred_to_facility" | "home_care_advised" | "incomplete";

export type DTMFAction = "emergency" | "english" | "hindi" | "repeat" | "unknown";

export type ICD10Code = string;

export type Duration = string;   // e.g. "2h", "24h", "1w"
export type ScheduleId = string;
export type S3Key = string;
export type AudioStream = Buffer | NodeJS.ReadableStream;
export type TranscribedText = string;
export type ImageData = Buffer | string;  // raw bytes or base64
export type ABCDEStepName = "airway" | "breathing" | "circulation" | "disability" | "exposure";

export const CONFIDENCE_THRESHOLD = 0.7;
