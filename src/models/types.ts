import {
  Language, Voice, EmergencyCondition, ChronicCondition, FacilityLevel,
  ActionType, DrugQueryType, SeverityLevel, TriageOutcome, DTMFAction,
  ICD10Code, Duration, ScheduleId, S3Key, AudioStream, ImageData
} from './enums';

export interface PatientProfile {
  category: "pediatric" | "adult" | "maternal" | "geriatric" | "unknown";
  exact_age_mentioned: string | null;
  pregnancy_flag: "confirmed" | "possible" | "not_applicable" | "unknown";
}

// ─── Master Extraction ───────────────────────────────────────────────────────

export interface MasterExtractionResult {
  is_emergency: boolean;
  condition_id:
    | "cardiac" | "snakebite" | "child_fever" | "breathing_difficulty"
    | "general_fever" | "maternal_care" | "chronic_disease"
    | "drug_query" | "unknown";
  patient_profile: PatientProfile;
  clinical_symptoms_english: string[];
  drugs_mentioned: { name: string; query_type: DrugQueryType }[];
  severity_signal: "critical" | "urgent" | "mild";
  duration: string | null;
  location_mentioned: string | null;
  danger_signs_present: string[];
  confidence: number;
  language_register: "pure_hindi" | "hinglish" | "english";
}

// ─── Conversation State (DynamoDB, keyed by callSid) ────────────────────────

export interface ConversationState {
  callSid: string;
  ttl: number;                        // Unix epoch + 3600s
  turn: number;
  language: Language;
  triagePath: "emergency" | "general" | "drug" | "unknown";
  abcdeStep: "airway" | "breathing" | "circulation" | "disability" | "exposure" | null;
  conditionId: string | null;
  patientProfile: PatientProfile | null;
  masterExtraction: MasterExtractionResult | null;
  dangerSignsDetected: string[];
  locationCollected: boolean;
  callStartTime: string;
  clinicalSummary: string;            // rolling English summary from Nova Pro — replaced after each turn, passed as context to next turn
}

// ─── Location ────────────────────────────────────────────────────────────────

export interface LocationData {
  tier1Voice?: {
    rawText: string;
    village?: string;
    landmark?: string;
    nearCity?: string;
    district?: string;
    state?: string;
    accuracy: "village" | "landmark" | "city";
    timestamp: string;
  };
  tier2Phone: {
    stdCode: string;
    city: string;
    state: string;
    district: string;
    accuracy: "district";
    method: "automatic";
  };
  tier3GPS?: {
    latitude: number;
    longitude: number;
    accuracy: "gps";
    timestamp: string;
  };
  primaryLocation: string;
  accuracyLevel: "gps" | "village" | "landmark" | "city" | "district" | "unknown";
}

export type Tier1Location = NonNullable<LocationData["tier1Voice"]>;
export type Tier2Location = LocationData["tier2Phone"];
export type Tier3Location = NonNullable<LocationData["tier3GPS"]>;

export interface ResolvedLocation {
  primaryLocation: string;
  accuracyLevel: LocationData["accuracyLevel"];
  tier1?: Tier1Location;
  tier2: Tier2Location;
  tier3?: Tier3Location;
}

// ─── Emergency Scripts ───────────────────────────────────────────────────────

export interface BilingualInstruction {
  hindi: string;
  english: string;
}

export interface ABCDEStep {
  questionHindi: string;
  questionEnglish: string;
  yesAction: BilingualInstruction;
  noAction: BilingualInstruction;
  escalationTrigger?: boolean;
}

export interface DispatchInfo {
  dispatchType: "108" | "102";
  dispatchNumber: string;
  messageHindi: string;
  messageEnglish: string;
}

export interface EmergencyScript {
  condition: EmergencyCondition;
  icd10Code: string;
  dispatchType: "108" | "102";
  severity: "CRITICAL";
  source: string;
  abcdeAssessment: {
    airway: ABCDEStep;
    breathing: ABCDEStep;
    circulation: ABCDEStep;
    disability: ABCDEStep;
    exposure: ABCDEStep;
  };
  immediateActions: BilingualInstruction[];
  doNotActions: BilingualInstruction[];
  dispatchInstructions: DispatchInfo;
}

export type ABCDEScript = EmergencyScript["abcdeAssessment"];

// ─── Drug KB ─────────────────────────────────────────────────────────────────

export interface DrugInfo {
  drug_name: string;
  query_type: DrugQueryType;
  dose_child?: string;
  dose_adult?: string;
  max_daily_adult?: string;
  max_daily_child?: string;
  contraindications: string[];
  pregnancy_category: string;
  renal_adjustment?: string;
  source: string;
  not_found?: boolean;
}

// ─── Triage ──────────────────────────────────────────────────────────────────

export interface TriageResult {
  callId: string;
  isEmergency: boolean;
  condition: string;
  icd10Code: string;
  severity: SeverityLevel;
  recommendedCareLevel: "home" | "PHC" | "CHC" | "district_hospital";
  treatmentAdvice: BilingualInstruction[];
  dispatchType: "108" | "102" | "none";
  followUpRequired: boolean;
  followUpInterval?: string;
  referralFacility?: Facility;
  ashaAlertRequired: boolean;
  chronicCareEnrollment?: ChronicCondition;
}

export interface TriageAssessment {
  conditionId: string;
  icd10Code: string;
  severity: SeverityLevel;
  recommendedCareLevel: "home" | "PHC" | "CHC" | "district_hospital";
  summaryHindi: string;
  summaryEnglish: string;
  followUpRequired: boolean;
  followUpInterval?: string;
}

export interface TreatmentAdvice {
  instructions: BilingualInstruction[];
  disclaimer: BilingualInstruction;
}

export interface TriageResponse {
  chunks: string[];
  generatedResponse: string;
  followUpQuestion?: string;
  severity: SeverityLevel;
}

export interface SymptomInput {
  clinicalSymptomsEnglish: string[];
  patientProfile: PatientProfile;
  conditionId: string;
  duration: string | null;
  dangerSignsPresent: string[];
  language: Language;                // "hindi" | "english" — from ConversationState
  rawUtterance: string;              // original caller speech — fallback for register detection
  language_register?: "pure_hindi" | "hinglish" | "english"; // from Nova Lite extraction; overrides detectRegister()
}

export interface KBResults {
  chunks: string[];
  sources: string[];
  relevanceScores: number[];
}

// ─── Intent Classification ───────────────────────────────────────────────────

export interface EmotionResult {
  emotion: "panic" | "distress" | "calm" | "unknown";
  confidence: number;
}

export interface ConversationContext {
  callId: string;
  turn: number;
  triagePath: "emergency" | "general" | "drug" | "unknown";
  transcriptHistory: string[];
  dangerSignsDetected: string[];
  patientProfile: PatientProfile | null;
  masterExtraction: MasterExtractionResult | null;
}

export interface ClassificationInput {
  transcribedText: string;
  language: Language;
  dtmfKey?: number;
  emotionResult?: EmotionResult;
  conversationContext?: ConversationContext;
}

export interface IntentResult {
  intent: "emergency" | "general_triage" | "drug";
  confidence: number;
  triggerType: "keyword" | "dtmf" | "emotion" | "sos" | "danger_sign" | "default";
  matchedKeywords?: string[];
}

export interface KeywordMatch {
  matched: boolean;
  keyword: string | null;
  conditionId: string | null;
  language: Language;
}

// ─── IVR Session ─────────────────────────────────────────────────────────────

export interface CallSession {
  callId: string;
  callerNumber: string;
  startTime: string;
  language: Language;
  status: "active" | "completed" | "dropped";
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

export interface EmergencyData {
  callId: string;
  condition: EmergencyCondition;
  icd10Code: string;
  abcdeSummary: string;
  location: LocationData;
  callerNumber: string;
  dispatchType: "108" | "102";
}

export interface DispatchResult {
  layer: 1 | 2 | 3;
  success: boolean;
  hospitalAccepted?: {
    hospitalId: string;
    hospitalName: string;
    estimatedArrival: string;
  };
  dispatcher108Connected?: boolean;
  smsSent?: boolean;
  ashaAlerted?: boolean;
}

// ─── Hospital & Facility ─────────────────────────────────────────────────────

export interface Hospital {
  hospitalId: string;
  name: string;
  address: string;
  phone: string;
  location: { latitude: number; longitude: number };
  facilityLevel: FacilityLevel;
  distanceKm?: number;
}

export interface Facility {
  facilityId: string;
  name: string;
  address: string;
  phone: string;
  facilityLevel: FacilityLevel;
  distanceKm?: number;
}

export interface FacilityCapabilities {
  facilityId: string;
  facilityLevel: FacilityLevel;
  hasICU: boolean;
  hasBloodBank: boolean;
  hasSurgery: boolean;
  hasMaternity: boolean;
  hasPediatrics: boolean;
  bedCount: number;
}

export interface AcceptanceConfirmation {
  hospitalId: string;
  emergencyId: string;
  acceptedAt: string;
  estimatedArrival: string;
  bedNumber?: string;
}

// ─── Call Record ─────────────────────────────────────────────────────────────

export interface CallRecord {
  callId: string;
  timestamp: string;
  ttl: number;
  callerNumber: string;
  callSourceType: "mobile" | "landline" | "unknown";
  language: Language;
  duration: number;
  triageOutcome: TriageOutcome;
  icd10Code: string;
  severityClassification: SeverityLevel;
  dispatchType: "108" | "102" | "none";
  actionsTaken: ActionType[];
  location: LocationData;
  recordingS3Key: string;
  bedrockTraceId: string;
  fhirRecord: FHIRCondition;
}

export type RedactedCallRecord = Omit<CallRecord, "callerNumber"> & { callerNumber: "[REDACTED]" };

// ─── FHIR ────────────────────────────────────────────────────────────────────

export interface FHIRCondition {
  resourceType: "Condition";
  code: {
    coding: [{
      system: "http://hl7.org/fhir/sid/icd-10";
      code: string;
      display: string;
    }];
  };
  subject?: { reference: string };
  recordedDate: string;
  severity: {
    coding: [{
      system: "http://snomed.info/sct";
      code: string;
      display: string;
    }];
  };
}

// ─── STD Code ────────────────────────────────────────────────────────────────

export interface STDCodeEntry {
  stdCode: string;
  city: string;
  state: string;
  district: string;
}

// ─── Outbreak / Surveillance ─────────────────────────────────────────────────

export interface OutbreakAlert {
  alertId: string;
  icd10Code: string;
  conditionName: string;
  location: { village?: string; district: string; state: string };
  callCount: number;
  timeWindowDays: number;
  threshold: number;
  severity: "watch" | "alert" | "critical";
  timestamp: string;
}

export interface AggregatedData {
  timeWindowDays: number;
  records: Array<{ icd10Code: string; district: string; state: string; count: number }>;
}

// ─── Chronic Care ────────────────────────────────────────────────────────────

export interface ChronicCareEnrollment {
  patientId: string;
  callerNumber: string;
  condition: ChronicCondition;
  icd10Code: string;
  assignedAshaWorkerId: string;
  assignedAshaWorkerPhone: string;
  monitoringSchedule: string;
  monitoringChecklist: string[];
  enrollmentDate: string;
  location: LocationData;
}

// ─── ASHA Worker ─────────────────────────────────────────────────────────────

export interface PatientSummary {
  callId: string;
  conditionId: string;
  icd10Code: string;
  severity: SeverityLevel;
  location: LocationData;
  treatmentSummaryHindi: string;
}

export interface MonitoringChecklist {
  condition: ChronicCondition;
  items: string[];
  frequency: "daily" | "weekly" | "biweekly";
  alertThresholds: string[];
}

// ─── Action Orchestrator ─────────────────────────────────────────────────────

export interface ActionResults {
  smsSent: boolean;
  dispatchResult?: DispatchResult;
  ashaAlerted: boolean;
  followUpScheduled: boolean;
  referralFacility?: Facility;
  surveillanceLogged: boolean;
}

// ─── Multimodal Vision ───────────────────────────────────────────────────────

export interface TriageContext {
  conditionId: string;
  patientProfile: PatientProfile;
  symptomsEnglish: string[];
}

export interface VisualAssessment {
  description: string;
  severity: SeverityLevel;
  confidence: number;
  recommendations: string[];
}

export interface SnakeIdentification {
  speciesName: string | null;
  isVenomous: boolean | null;
  confidence: number;
  antivenomRequired: boolean;
}

export interface WoundAssessment {
  woundType: string;
  severity: SeverityLevel;
  infectionRisk: "low" | "moderate" | "high";
  recommendations: string[];
}

// Re-export enums so consumers only need to import from types
export {
  Language, Voice, EmergencyCondition, ChronicCondition, FacilityLevel,
  ActionType, DrugQueryType, SeverityLevel, TriageOutcome, DTMFAction,
  ICD10Code, Duration, ScheduleId, S3Key, AudioStream, ImageData,
  CONFIDENCE_THRESHOLD
} from './enums';
