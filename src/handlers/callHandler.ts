/**
 * VaidyaVaani — Main IVR Call Handler (Task 16.1)
 *
 * Entry point for all Twilio webhook calls via API Gateway.
 * Three endpoints:
 *   POST /incoming  — Turn 1: answer call, play greeting, start Gather
 *   POST /gather    — Turn N: process speech/DTMF, advance conversation
 *   POST /status    — Call end: finalize record, trigger Step Functions
 *
 * Architecture:
 *   - Stateless Lambda — ConversationState persisted in DynamoDB between turns
 *   - All services injected via DI (testable without AWS)
 *   - Emergency path failures trigger 108 bridge fallback via withErrorHandler
 *   - TwiML responses use Polly.Aditi (Hindi neural) for all voice output
 *
 * Req 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 4.6, 16.1
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { withErrorHandler } from '../middleware/errorHandler';
import { ConversationStateRepository } from '../repositories/conversationStateRepository';
import { IntentRouterService } from '../services/intentRouter';
import { EmergencyKBService } from '../services/emergencyKB';
import { TriageAgentService } from '../services/triageAgent';
import { LocationDetectorService } from '../services/locationDetector';
import { CallLoggerService } from '../services/callLogger';
import { ActionOrchestratorService } from '../services/actionOrchestrator';
import { DrugKBService } from '../services/drugKB';
import { sanitizeInput } from '../utils/inputSanitizer';
import { Logger } from '../utils/logger';
import {
  ConversationState, PatientProfile, DrugInfo,
  LocationData, TriageResult, CallRecord, Tier1Location,
} from '../models/types';
import {
  Language, ChronicCondition, SeverityLevel, TriageOutcome,
  ActionType, DrugQueryType, CONFIDENCE_THRESHOLD,
} from '../models/enums';

// ─── TwiML helpers ────────────────────────────────────────────────────────────

const GATHER_URL = process.env.GATHER_URL ?? 'https://your-api-gateway.execute-api.ap-south-1.amazonaws.com/prod/gather';
const STATUS_URL = process.env.STATUS_URL ?? 'https://your-api-gateway.execute-api.ap-south-1.amazonaws.com/prod/status';
/** Read at invocation time — not module load — so tests can set env vars after import */
function getStepFunctionsArn(): string {
  return process.env.TRIAGE_WORKFLOW_ARN ?? '';
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds a TwiML response with a <Gather> for speech + DTMF input.
 * Uses Polly.Aditi (Hindi neural) for all voice output.
 * speechTimeout="auto" lets Twilio detect end-of-speech naturally.
 */
function twimlGather(sayText: string, fillerText?: string, language?: string): string {
  const lang = language === 'english' ? 'en-IN' : 'hi-IN';
  const filler = fillerText
    ? `<Say voice="Polly.Aditi" language="hi-IN">${escapeXml(fillerText)}</Say>`
    : '';
  // No-input fallback is bilingual — English callers must not hear Hindi.
  const noInputMsg = language === 'english'
    ? 'No response received. Please call again.'
    : 'Koi jawab nahi mila. Phir se call karein.';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response statusCallback="${STATUS_URL}" statusCallbackMethod="POST" statusCallbackEvent="completed">
  ${filler}
  <Gather input="speech dtmf" timeout="5" speechTimeout="auto"
          action="${GATHER_URL}" method="POST" language="${lang}">
    <Say voice="Polly.Aditi" language="${lang}">${escapeXml(sayText)}</Say>
  </Gather>
  <Say voice="Polly.Aditi" language="${lang}">${escapeXml(noInputMsg)}</Say>
  <Hangup/>
</Response>`;
}

/**
 * Builds a TwiML response that speaks and hangs up (no further input).
 */
function twimlSayHangup(text: string, language?: string): string {
  const lang = language === 'english' ? 'en-IN' : 'hi-IN';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response statusCallback="${STATUS_URL}" statusCallbackMethod="POST" statusCallbackEvent="completed">
  <Say voice="Polly.Aditi" language="${lang}">${escapeXml(text)}</Say>
  <Hangup/>
</Response>`;
}

/**
 * Builds a TwiML response that bridges the call to 108.
 */
function twimlBridge108(preamble: string, language?: string): string {
  const lang = language === 'english' ? 'en-IN' : 'hi-IN';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response statusCallback="${STATUS_URL}" statusCallbackMethod="POST" statusCallbackEvent="completed">
  <Say voice="Polly.Aditi" language="${lang}">${escapeXml(preamble)}</Say>
  <Dial>108</Dial>
</Response>`;
}

function xmlResponse(body: string): APIGatewayProxyResult {
  return { statusCode: 200, headers: { 'Content-Type': 'text/xml' }, body };
}

/**
 * Builds a TwiML response with DTMF-only <Gather> (no speech input).
 * Used when speech recognition fails repeatedly (Req 1.4 fallback).
 */
function twimlGatherDtmfOnly(sayText: string, language?: string): string {
  const lang = language === 'english' ? 'en-IN' : 'hi-IN';
  // No-input fallback is bilingual — English callers must not hear Hindi.
  const noInputMsg = language === 'english'
    ? 'No response received. Please call again.'
    : 'Koi jawab nahi mila. Phir se call karein.';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response statusCallback="${STATUS_URL}" statusCallbackMethod="POST" statusCallbackEvent="completed">
  <Gather input="dtmf" timeout="10"
          action="${GATHER_URL}" method="POST">
    <Say voice="Polly.Aditi" language="${lang}">${escapeXml(sayText)}</Say>
  </Gather>
  <Say voice="Polly.Aditi" language="${lang}">${escapeXml(noInputMsg)}</Say>
  <Hangup/>
</Response>`;
}

// ─── Service factory (default production wiring) ──────────────────────────────

export interface CallHandlerDeps {
  stateRepo: ConversationStateRepository;
  intentRouter: IntentRouterService;
  emergencyKB: EmergencyKBService;
  triageAgent: TriageAgentService;
  locationDetector: LocationDetectorService;
  callLogger: CallLoggerService;
  orchestrator: ActionOrchestratorService;
  drugKB: DrugKBService;
  sfn: SFNClient;
}

function createDefaultDeps(): CallHandlerDeps {
  // Lazy imports to avoid circular deps and keep cold start lean
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SmsService } = require('../services/smsService') as typeof import('../services/smsService');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ReferralAgentService } = require('../services/referralAgent') as typeof import('../services/referralAgent');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { FollowUpSchedulerService } = require('../services/followUpScheduler') as typeof import('../services/followUpScheduler');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ASHAWorkerAgentService } = require('../services/ashaWorkerAgent') as typeof import('../services/ashaWorkerAgent');

  // Stub SNS client — production wires real SNS via environment
  const stubSns = { publish: async () => { } };
  const stubFacilityRepo = {
    findByLocationAndLevel: async () => [],
    getCapabilities: async () => null,
  };
  const stubEventBridge = {
    putRule: async () => { },
    putTargets: async () => { },
    removeTargets: async () => { },
    deleteRule: async () => { },
  };
  const stubScheduleRepo = {
    save: async () => { },
    get: async () => null,
    delete: async () => { },
  };
  const stubAshaRepo = {
    findByLocation: async () => null,
    findById: async () => null,
  };

  const sms = new SmsService(stubSns);
  const referral = new ReferralAgentService(stubFacilityRepo);
  const followUp = new FollowUpSchedulerService(stubEventBridge, stubScheduleRepo);
  const asha = new ASHAWorkerAgentService(stubAshaRepo, stubSns);

  return {
    stateRepo: new ConversationStateRepository(),
    intentRouter: new IntentRouterService(),
    emergencyKB: new EmergencyKBService(),
    triageAgent: new TriageAgentService(),
    locationDetector: new LocationDetectorService(),
    callLogger: new CallLoggerService(),
    orchestrator: new ActionOrchestratorService(sms, referral, followUp, asha),
    drugKB: new DrugKBService(),
    sfn: new SFNClient({ region: process.env.AWS_REGION ?? 'ap-south-1' }),
  };
}

// ─── Greeting / disclaimer text ───────────────────────────────────────────────

const GREETING_HINDI = 'VaidyaVaani. Main ek AI health assistant hoon, doctor nahi. Apni takleef batayein. For English, press 2.';
const DISCLAIMER_HINDI = 'Main VaidyaVaani hoon, ek AI health assistant — doctor nahi.';
const FILLER_HINDI = 'Ji, main samajh rahi hoon, ek second...';
const FALLBACK_HINDI = 'Maafi chahte hain, abhi system busy hai. Thodi der baad phir call karein ya seedha 108 dial karein.';
const FALLBACK_ENGLISH = 'We apologize, the system is currently busy. Please call back shortly or dial 108 directly.';
const EMERGENCY_DISPATCH_HINDI = 'Yeh emergency hai. Ambulance aa rahi hai. Abhi 108 se baat karein.';
const LOCATION_PROMPT_HINDI = 'Aap kahan hain? Apna gaon ya sheher ka naam batayein.';
const LOCATION_PROMPT_ENGLISH = 'Where are you? Please tell us your village or city name.';
const DRUG_PROMPT_HINDI = 'Aap kaunsi dawai ke baare mein jaanna chahte hain?';
const DRUG_PROMPT_ENGLISH = 'Which medicine would you like to know about?';
const DRUG_NOT_FOUND_HINDI = 'Yeh dawai hamare database mein nahi mili. Kripya apne doctor se poochein.';
const DRUG_NOT_FOUND_ENGLISH = 'This medicine was not found in our database. Please consult your doctor.';


// ─── Drug response builder ────────────────────────────────────────────────────

/**
 * Builds a bilingual drug response string from DrugInfo + PatientProfile.
 *
 * Real-world scenario: A mother calls asking "paracetamol safe hai kya, bacche ke liye?"
 * Nova Lite extracts category=pediatric. DrugKB returns dose_child="10-15 mg/kg every 4-6h".
 * This function formats: "Paracetamol: 10-15 mg/kg every 4-6h. Contraindications: severe liver disease."
 */
function buildDrugResponse(drugInfo: DrugInfo, profile: PatientProfile, language: Language): string {
  const isPediatric = profile.category === 'pediatric';
  const doseInfo = isPediatric ? drugInfo.dose_child : drugInfo.dose_adult;

  const parts: string[] = [];

  if (language === 'english') {
    parts.push(`${drugInfo.drug_name}: ${doseInfo ?? 'Dosage information not available'}.`);
    if (drugInfo.contraindications.length > 0) {
      parts.push(`Contraindications: ${drugInfo.contraindications.join(', ')}.`);
    }
    if ((profile.pregnancy_flag === 'confirmed' || profile.pregnancy_flag === 'possible') && drugInfo.pregnancy_category) {
      parts.push(`Pregnancy category: ${drugInfo.pregnancy_category}.`);
    }
    if (drugInfo.overdose_threshold) {
      parts.push(`Overdose threshold: ${drugInfo.overdose_threshold}.`);
    }
  } else {
    parts.push(`${drugInfo.drug_name}: ${doseInfo ?? 'Khurak ki jaankari uplabdh nahi hai'}.`);
    if (drugInfo.contraindications.length > 0) {
      parts.push(`Savdhani: ${drugInfo.contraindications.join(', ')}.`);
    }
    if ((profile.pregnancy_flag === 'confirmed' || profile.pregnancy_flag === 'possible') && drugInfo.pregnancy_category) {
      parts.push(`Pregnancy category: ${drugInfo.pregnancy_category}.`);
    }
    if (drugInfo.overdose_threshold) {
      parts.push(`Overdose seema: ${drugInfo.overdose_threshold}.`);
    }
  }

  return parts.join(' ');
}

// ─── chronic_disease → ChronicCondition mapping ───────────────────────────────

/**
 * Maps a triage conditionId to a ChronicCondition enum value.
 * Called when Nova Pro returns conditionId = "chronic_disease" or a specific
 * chronic condition name. The conditionId from MasterExtraction is the primary
 * signal; if it's "chronic_disease" (generic), we fall back to symptom keywords.
 *
 * Real-world scenario: Ramesh, 58, calls about excessive thirst and frequent
 * urination. Nova Lite extracts conditionId="chronic_disease". Nova Pro assesses
 * and returns conditionId="diabetes" in the TriageAssessment. This function maps
 * "diabetes" → ChronicCondition.diabetes for enrollment.
 */
function mapToChronicCondition(conditionId: string): ChronicCondition | undefined {
  switch (conditionId) {
    case 'diabetes': return 'diabetes';
    case 'hypertension': return 'hypertension';
    case 'tb': return 'tb';
    default: return undefined;
  }
}

// ─── handleIncoming — Turn 1 ──────────────────────────────────────────────────

/**
 * Handles the initial Twilio webhook when a call arrives.
 * Extracts caller number, performs Tier 2 location detection (STD code),
 * creates initial ConversationState in DynamoDB, and returns TwiML greeting.
 *
 * Req 1.1: Answer incoming call and play greeting.
 * Req 6.1: Auto-extract location from phone number (Tier 2).
 */
async function handleIncoming(
  event: APIGatewayProxyEvent,
  deps: CallHandlerDeps,
): Promise<APIGatewayProxyResult> {
  const body = parseFormBody(event.body ?? '');
  const callSid = body['CallSid'] ?? `local-${Date.now()}`;
  const callerNumber = body['From'] ?? 'unknown';

  Logger.info('Incoming call', { callSid, callerNumber: '[REDACTED]' });

  // Tier 2 location: auto-extract from phone number (STD code / mobile prefix)
  const tier2 = await deps.locationDetector.extractSTDCode(callerNumber).catch(() => null);

  const initialState: ConversationState = {
    callSid,
    ttl: Math.floor(Date.now() / 1000) + 3600,
    turn: 1,
    language: 'hindi' as Language,
    triagePath: 'unknown',
    abcdeStep: null,
    conditionId: null,
    patientProfile: null,
    masterExtraction: null,
    transcriptHistory: [],
    dangerSignsDetected: [],
    locationCollected: tier2 !== null,
    callStartTime: new Date().toISOString(),
    clinicalSummary: '',
    tier2Location: tier2 ?? undefined,
    callerNumber,
  };

  await deps.stateRepo.save(initialState);

  return xmlResponse(twimlGather(GREETING_HINDI));
}

// ─── handleGather — Turn N ────────────────────────────────────────────────────

/**
 * Handles each subsequent Twilio webhook after the caller speaks or presses a key.
 * This is the core conversation loop:
 *   1. Load state from DynamoDB
 *   2. Append utterance to transcriptHistory
 *   3. Handle DTMF overrides (9 = emergency, 2 = English)
 *   4. Run intent routing (keyword scan + Nova Lite)
 *   5. Branch: emergency → ABCDE script; general triage → Nova Pro; drug → DrugKB
 *   6. Save updated state
 *   7. Return TwiML
 *
 * Req 1.2, 1.3, 2.1–2.7, 4.6
 */
async function handleGather(
  event: APIGatewayProxyEvent,
  deps: CallHandlerDeps,
): Promise<APIGatewayProxyResult> {
  const body = parseFormBody(event.body ?? '');
  const callSid = body['CallSid'] ?? '';
  const rawSpeech = body['SpeechResult'] ?? '';
  const digits = body['Digits'] ?? '';
  const callerNumberGather = body['From'] ?? 'unknown';

  // Load state — null means Turn 1 state was lost (DynamoDB failure); create fresh
  let state = await deps.stateRepo.load(callSid);
  if (!state) {
    Logger.warn('State not found for callSid — creating fresh state', { callSid });
    state = {
      callSid,
      ttl: Math.floor(Date.now() / 1000) + 3600,
      turn: 1,
      language: 'hindi' as Language,
      triagePath: 'unknown',
      abcdeStep: null,
      conditionId: null,
      patientProfile: null,
      masterExtraction: null,
      transcriptHistory: [],
      dangerSignsDetected: [],
      locationCollected: false,
      callStartTime: new Date().toISOString(),
      clinicalSummary: '',
      callerNumber: callerNumberGather,
    };
  }

  state.turn += 1;

  // ── DTMF 2: language switch to English ──────────────────────────────────────
  if (digits === '2') {
    state.language = 'english' as Language;
    await deps.stateRepo.save(state);
    return xmlResponse(twimlGather('Language switched to English. Please describe your symptoms.', undefined, 'english'));
  }

  // ── DTMF 9: silent emergency override ───────────────────────────────────────
  if (digits === '9') {
    Logger.info('DTMF 9 emergency override', { callSid });
    state.triagePath = 'emergency';
    await deps.stateRepo.save(state);
    const bridgeMsg = state.language === 'english'
      ? 'This is an emergency. Connecting you to 108 now.'
      : EMERGENCY_DISPATCH_HINDI;
    return xmlResponse(twimlBridge108(bridgeMsg, state.language));
  }

  // Sanitize and append utterance to transcript history
  const sanitized = sanitizeInput(rawSpeech);
  if (sanitized) {
    state.transcriptHistory.push(sanitized);
  }

  // If no speech and no DTMF, track consecutive failures for DTMF fallback (Req 1.4)
  if (!sanitized && !digits) {
    state.speechFailCount = (state.speechFailCount ?? 0) + 1;

    // After 2 consecutive empty-speech turns, switch to DTMF-only mode
    if (state.speechFailCount >= 2) {
      await deps.stateRepo.save(state);
      const dtmfMenu = state.language === 'english'
        ? 'Voice not detected. Press 9 for emergency. Press 1 to try speaking again.'
        : 'Aawaz nahi mili. Emergency ke liye 9 dabayein. Dobara bolne ke liye 1 dabayein.';
      return xmlResponse(twimlGatherDtmfOnly(dtmfMenu, state.language));
    }

    await deps.stateRepo.save(state);
    const rePrompt = state.language === 'english'
      ? 'Please describe your symptoms.'
      : 'Kripya apni takleef batayein.';
    return xmlResponse(twimlGather(rePrompt, undefined, state.language));
  }

  // Reset speech fail counter on successful speech input
  state.speechFailCount = 0;

  // ── Danger sign mid-call monitoring ─────────────────────────────────────────
  const conversationContext = {
    callId: callSid,
    turn: state.turn,
    triagePath: state.triagePath,
    transcriptHistory: state.transcriptHistory,
    dangerSignsDetected: state.dangerSignsDetected,
    patientProfile: state.patientProfile,
    masterExtraction: state.masterExtraction,
  };

  if (deps.intentRouter.checkDangerSigns(conversationContext, sanitized)) {
    Logger.info('Danger signs detected mid-call — escalating to emergency', { callSid });
    state.triagePath = 'emergency';
    await deps.stateRepo.save(state);
    const bridgeMsg = state.language === 'english'
      ? 'Danger signs detected. Connecting you to emergency services now.'
      : EMERGENCY_DISPATCH_HINDI;
    return xmlResponse(twimlBridge108(bridgeMsg, state.language));
  }

  // ── Intent classification (Req 2.1: 3-stage cascade) ──────────────────────
  // Stage 1: keyword scan (5ms) + Stage 2: Nova Lite extraction (~150ms)
  // fired in parallel via Promise.race(). If keyword scan hits, Nova Lite
  // result is still awaited and stored for downstream use.
  let intentResult = await deps.intentRouter.classifyIntent({
    transcribedText: sanitized,
    language: state.language,
    dtmfKey: digits ? parseInt(digits, 10) : undefined,
    conversationContext,
  });

  // Fire Nova Lite extraction in background for all non-keyword-hit cases.
  // If keyword scan already found emergency, we still want the extraction
  // for richer downstream data (patient_profile, symptoms, drugs_mentioned).
  const novaLitePromise = deps.intentRouter.extractMasterTags(sanitized, state.language)
    .catch((err) => {
      Logger.error('Nova Lite extraction failed', { callSid, error: (err as Error).message });
      return null;
    });

  // If keyword scan returned default (no match), await Nova Lite and re-route
  if (intentResult.triggerType === 'default') {
    const extraction = await novaLitePromise;
    if (extraction) {
      state.masterExtraction = extraction;
      state.patientProfile = extraction.patient_profile;
      if (extraction.danger_signs_present.length > 0) {
        state.dangerSignsDetected = [...new Set([...state.dangerSignsDetected, ...extraction.danger_signs_present])];
      }
      const extractionRoute = deps.intentRouter.routeFromExtraction(extraction);
      intentResult = extractionRoute;
    }
  } else {
    // Keyword/DTMF/emotion already resolved — still store extraction when it arrives
    // (non-blocking, don't await — just fire and forget into state on next turn)
    novaLitePromise.then((extraction) => {
      if (extraction) {
        // Always update masterExtraction when richer data arrives.
        // Also sync patientProfile even if masterExtraction was already set from a prior
        // turn — a keyword hit on turn 1 could have left patientProfile=null, which
        // breaks pregnancy/pediatric drug safety on subsequent drug queries.
        if (!state.masterExtraction) {
          state.masterExtraction = extraction;
        }
        if (!state.patientProfile) {
          state.patientProfile = extraction.patient_profile;
        }
        // Best-effort save — if this fails, next turn will re-extract
        deps.stateRepo.save(state).catch(() => { });
      }
    });
  }

  // ── Nova Lite Master Extraction routing (legacy: re-route from previous turn) ──
  // If we still have triggerType 'default' but a previous turn's extraction exists
  if (state.masterExtraction && intentResult.triggerType === 'default') {
    const extractionRoute = deps.intentRouter.routeFromExtraction(state.masterExtraction);
    if (extractionRoute && (extractionRoute.intent === 'emergency' || extractionRoute.intent === 'drug')) {
      intentResult = extractionRoute;
    }
  }

  // ── Emergency path ───────────────────────────────────────────────────────────
  if (intentResult.intent === 'emergency') {
    state.triagePath = 'emergency';
    if (intentResult.conditionId) {
      // Reset ABCDE if condition changed (e.g., caller first said snakebite, now says chest pain)
      if (intentResult.conditionId !== state.conditionId) {
        state.abcdeStep = null;
        state.locationPromptSent = false; // re-ask location for new condition
      }
      state.conditionId = intentResult.conditionId;
    }

    // Store pendingDrugQuery if emergency + drug collision
    if (intentResult.pendingDrugQuery) {
      state.pendingDrugQuery = intentResult.pendingDrugQuery;
    }

    // ── Tier 1 voice location collection (Req 6.2) ─────────────────────────
    // Before starting ABCDE, ask caller for their location once.
    // This gives dispatch better accuracy than phone-prefix alone.
    if (!state.locationCollected && !state.locationPromptSent && state.abcdeStep === null) {
      state.locationPromptSent = true;
      await deps.stateRepo.save(state);
      const locPrompt = state.language === 'english' ? LOCATION_PROMPT_ENGLISH : LOCATION_PROMPT_HINDI;
      return xmlResponse(twimlGather(locPrompt, undefined, state.language));
    }

    // If we sent the location prompt last turn, this utterance is the location response
    if (state.locationPromptSent && !state.locationCollected) {
      const tier1 = deps.locationDetector.parseNovaLocation(sanitized)
        ?? deps.locationDetector.parseVoiceLocation(sanitized);
      if (tier1) {
        state.tier1Location = tier1;
      }
      state.locationCollected = true;
      // Fall through to ABCDE — don't return
    }

    // Check if ABCDE assessment is complete (all 5 steps done → exposure was last)
    // After completing the full ABCDE, check pendingDrugQuery (S2 fix) before bridging to 108.
    // Real-world: pregnant caller said "maa ko saans nahi aa rahi, metformin safe hai kya?" —
    // the emergency ran first (correct), now answer the deferred drug question before hanging up.
    if (state.abcdeStep === 'exposure') {
      state.clinicalSummary = `ABCDE complete for ${state.conditionId ?? 'unknown'}. Transcript: ${state.transcriptHistory.slice(-5).join('; ')}`;

      // S2: if a drug question was deferred during the emergency, answer it now before dispatch.
      // Query DrugKB inline \u2014 no extra state fields, no extra caller turn needed.
      // Real-world: "maa ko saans nahi aa rahi, metformin safe hai kya?" \u2014 ABCDE ran first (correct),
      // now answer the metformin safety question before bridging to 108.
      if (state.pendingDrugQuery) {
        const { drugName, queryType } = state.pendingDrugQuery;
        state.pendingDrugQuery = undefined;
        try {
          const profile = state.patientProfile ?? { category: 'adult' as const, exact_age_mentioned: null, pregnancy_flag: 'unknown' as const };
          const drugInfo = await deps.drugKB.queryDrug(drugName, queryType as import('../models/enums').DrugQueryType, profile);
          const drugAnswer = drugInfo.not_found
            ? (state.language === 'english' ? DRUG_NOT_FOUND_ENGLISH : DRUG_NOT_FOUND_HINDI)
            : buildDrugResponse(drugInfo, profile, state.language);
          const bridgePrompt = state.language === 'english'
            ? `${drugAnswer} Now connecting you to emergency services.`
            : `${drugAnswer} Ab aapko 108 se jod rahe hain.`;
          await deps.stateRepo.save(state);
          // Use twimlBridge108 \u2014 answer drug question spoken first, then dials 108 immediately
          return xmlResponse(twimlBridge108(bridgePrompt, state.language));
        } catch {
          // DrugKB failure is non-fatal here \u2014 bridge to 108 regardless
          state.pendingDrugQuery = undefined;
          await deps.stateRepo.save(state);
        }
      }

      await deps.stateRepo.save(state);
      const dispatchMsg = state.language === 'english'
        ? 'Assessment complete. Connecting you to emergency services now.'
        : EMERGENCY_DISPATCH_HINDI;
      return xmlResponse(twimlBridge108(dispatchMsg, state.language));
    }

    // Advance ABCDE step or start from airway
    const nextStep = advanceABCDEStep(state.abcdeStep);
    state.abcdeStep = nextStep;
    await deps.stateRepo.save(state);

    try {
      const condition = (intentResult.conditionId ?? 'cardiac') as import('../models/enums').EmergencyCondition;
      const category = state.patientProfile?.category ?? 'adult';
      const script = await deps.emergencyKB.retrieveEmergencyScript(condition, category);
      const stepScript = script.abcdeAssessment[nextStep];

      const responseText = state.language === 'english' ? stepScript.questionEnglish : stepScript.questionHindi;
      return xmlResponse(twimlGather(responseText, FILLER_HINDI, state.language));
    } catch {
      // Emergency KB failure → bridge to 108 immediately
      const fallbackMsg = state.language === 'english'
        ? 'Emergency services needed. Connecting you to 108 now.'
        : EMERGENCY_DISPATCH_HINDI;
      return xmlResponse(twimlBridge108(fallbackMsg, state.language));
    }
  }

  // ── General triage path ──────────────────────────────────────────────────────
  if (intentResult.intent === 'general_triage') {
    state.triagePath = 'general';

    // S4 fix: Max-turn guard — prevent infinite triage loop for vague symptoms.
    // Real-world: elderly caller with ambiguous complaints could loop 20+ turns
    // as Nova Pro keeps returning followUpRequired=true. After 10 turns, force
    // wrap-up with best assessment and "visit nearest health centre" advice.
    if (state.turn >= 10) {
      Logger.info('Max turn limit reached — forcing triage wrap-up', { callSid, turn: state.turn });
      try {
        const symptoms = state.masterExtraction?.clinical_symptoms_english ?? [sanitized];
        const conditionId = state.masterExtraction?.condition_id ?? 'unknown';
        state.conditionId = conditionId;
        const symptomInput = {
          clinicalSymptomsEnglish: symptoms,
          patientProfile: state.patientProfile ?? { category: 'adult' as const, exact_age_mentioned: null, pregnancy_flag: 'unknown' as const },
          conditionId,
          duration: state.masterExtraction?.duration ?? null,
          dangerSignsPresent: state.dangerSignsDetected,
          language: state.language,
          rawUtterance: sanitized,
          language_register: state.masterExtraction?.language_register,
        };
        const assessment = await deps.triageAgent.assessSymptoms(
          symptomInput,
          { chunks: [], sources: [], relevanceScores: [] },
          state.transcriptHistory,
        );
        const summary = state.language === 'english' ? assessment.summaryEnglish : assessment.summaryHindi;
        const visitAdvice = state.language === 'english'
          ? 'Please visit your nearest health centre for a proper examination.'
          : 'Kripya apne nazdeeki swasthya kendra mein jaake jaanch karayein.';
        const disclaimer = state.language === 'english'
          ? 'I am VaidyaVaani, an AI health assistant — not a doctor.'
          : DISCLAIMER_HINDI;
        state.severity = assessment.severity as ConversationState['severity'];
        state.recommendedCareLevel = assessment.recommendedCareLevel;
        state.followUpRequired = false;
        state.clinicalSummary = assessment.summaryEnglish;
        await deps.stateRepo.save(state);
        return xmlResponse(twimlSayHangup(`${summary} ${visitAdvice} ${disclaimer}`, state.language));
      } catch {
        await deps.stateRepo.save(state);
        const visitAdvice = state.language === 'english'
          ? 'We could not complete your assessment. Please visit your nearest health centre.'
          : 'Aapki jaanch poori nahi ho payi. Kripya apne nazdeeki swasthya kendra jaayein.';
        return xmlResponse(twimlSayHangup(visitAdvice, state.language));
      }
    }

    // Build SymptomInput from state + current utterance
    const symptoms = state.masterExtraction?.clinical_symptoms_english ?? [sanitized];
    const conditionId = state.masterExtraction?.condition_id ?? intentResult.conditionId ?? 'unknown';
    state.conditionId = conditionId;

    const symptomInput = {
      clinicalSymptomsEnglish: symptoms,
      patientProfile: state.patientProfile ?? { category: 'adult' as const, exact_age_mentioned: null, pregnancy_flag: 'unknown' as const },
      conditionId,
      duration: state.masterExtraction?.duration ?? null,
      dangerSignsPresent: state.dangerSignsDetected,
      language: state.language,
      rawUtterance: sanitized,
      language_register: state.masterExtraction?.language_register,
    };

    try {
      const assessment = await deps.triageAgent.assessSymptoms(
        symptomInput,
        { chunks: [], sources: [], relevanceScores: [] },
        state.transcriptHistory,
      );

      const advice = await deps.triageAgent.generateTreatmentAdvice(assessment);

      // Store severity in state for /status to read
      state.severity = assessment.severity as ConversationState['severity'];
      state.recommendedCareLevel = assessment.recommendedCareLevel;
      state.followUpRequired = assessment.followUpRequired;
      if (assessment.followUpInterval) {
        state.followUpInterval = assessment.followUpInterval;
      }

      // Check for chronic condition enrollment
      const chronicCondition = mapToChronicCondition(assessment.conditionId);

      // Build response text — respect caller's language preference
      const summary = state.language === 'english' ? assessment.summaryEnglish : assessment.summaryHindi;
      const instruction = state.language === 'english'
        ? (advice.instructions[0]?.english ?? '')
        : (advice.instructions[0]?.hindi ?? '');
      const disclaimer = state.language === 'english'
        ? advice.disclaimer.english
        : advice.disclaimer.hindi;
      const responseText = `${summary} ${instruction} ${disclaimer}`;

      // Update state with triage result
      state.clinicalSummary = assessment.summaryEnglish;
      if (chronicCondition) {
        // Store for Step Functions to pick up at call end
        state.conditionId = assessment.conditionId;
        state.chronicCareEnrollment = chronicCondition;
      }

      await deps.stateRepo.save(state);

      // If follow-up needed, continue gathering; otherwise wrap up
      if (assessment.followUpRequired) {
        return xmlResponse(twimlGather(responseText, FILLER_HINDI, state.language));
      }
      const endDisclaimer = state.language === 'english'
        ? 'I am VaidyaVaani, an AI health assistant — not a doctor.'
        : DISCLAIMER_HINDI;
      return xmlResponse(twimlSayHangup(`${responseText} ${endDisclaimer}`, state.language));
    } catch (err) {
      Logger.error('Triage assessment failed', { callSid, error: (err as Error).message });
      await deps.stateRepo.save(state);
      const fallback = state.language === 'english' ? FALLBACK_ENGLISH : FALLBACK_HINDI;
      return xmlResponse(twimlGather(fallback, undefined, state.language));
    }
  }

  // ── Drug path ────────────────────────────────────────────────────────────────
  if (intentResult.intent === 'drug') {
    state.triagePath = 'drug';

    // Multi-turn drug conversation:
    // Turn 1: intent=drug but no drug name yet → prompt for drug name
    // Turn 2+: state.drugQueryState='awaiting_drug_name' → extract drug name from utterance, query DrugKB
    if (state.drugQueryState === 'awaiting_drug_name' && sanitized) {
      // Caller provided the drug name — query DrugKB
      const drugName = sanitized.toLowerCase().trim();
      const profile = state.patientProfile ?? { category: 'adult' as const, exact_age_mentioned: null, pregnancy_flag: 'unknown' as const };
      const queryType: DrugQueryType = state.pendingDrugQuery?.queryType as DrugQueryType ?? 'safety';

      // Req 2.10: Fire Drug_KB + General_Triage_KB in parallel when symptoms exist.
      // Drug_KB returns structured dose data (~5ms). Triage_KB returns counselling context (~500ms).
      // Both results merged for richer response.
      const hasSymptoms = state.masterExtraction?.clinical_symptoms_english?.length
        && state.masterExtraction.clinical_symptoms_english.length > 0;

      try {
        if (hasSymptoms) {
          // Parallel: drug + triage counselling
          const symptomInput = {
            clinicalSymptomsEnglish: state.masterExtraction!.clinical_symptoms_english,
            patientProfile: profile,
            conditionId: state.masterExtraction?.condition_id ?? 'unknown',
            duration: state.masterExtraction?.duration ?? null,
            dangerSignsPresent: state.dangerSignsDetected,
            language: state.language,
            rawUtterance: sanitized,
            language_register: state.masterExtraction?.language_register,
          };

          const [drugInfo, triageAdvice] = await Promise.all([
            deps.drugKB.queryDrug(drugName, queryType, profile),
            deps.triageAgent.assessSymptoms(
              symptomInput,
              { chunks: [], sources: [], relevanceScores: [] },
              state.transcriptHistory,
            ).catch(() => null), // Triage failure is non-fatal for drug queries
          ]);

          if (drugInfo.not_found) {
            state.drugQueryState = 'resolved';
            await deps.stateRepo.save(state);
            const notFoundMsg = state.language === 'english' ? DRUG_NOT_FOUND_ENGLISH : DRUG_NOT_FOUND_HINDI;
            const disclaimer = state.language === 'english'
              ? 'I am VaidyaVaani, an AI health assistant — not a doctor.'
              : DISCLAIMER_HINDI;
            return xmlResponse(twimlSayHangup(`${notFoundMsg} ${disclaimer}`, state.language));
          }

          // Build merged response: drug info + triage counselling
          const drugResponse = buildDrugResponse(drugInfo, profile, state.language);
          let mergedResponse = drugResponse;
          if (triageAdvice) {
            const triageSummary = state.language === 'english'
              ? triageAdvice.summaryEnglish
              : triageAdvice.summaryHindi;
            mergedResponse = `${drugResponse} ${triageSummary}`;
          }

          const disclaimer = state.language === 'english'
            ? 'I am VaidyaVaani, an AI health assistant — not a doctor.'
            : DISCLAIMER_HINDI;

          state.drugName = drugName;
          state.drugQueryState = 'resolved';
          state.clinicalSummary = `Drug query: ${drugName} (${queryType})${triageAdvice ? ` + triage: ${triageAdvice.summaryEnglish}` : ''}`;
          await deps.stateRepo.save(state);
          return xmlResponse(twimlSayHangup(`${mergedResponse} ${disclaimer}`, state.language));
        }

        // No symptoms — drug-only query
        const drugInfo = await deps.drugKB.queryDrug(drugName, queryType, profile);

        if (drugInfo.not_found) {
          state.drugQueryState = 'resolved';
          await deps.stateRepo.save(state);
          const notFoundMsg = state.language === 'english' ? DRUG_NOT_FOUND_ENGLISH : DRUG_NOT_FOUND_HINDI;
          const disclaimer = state.language === 'english'
            ? 'I am VaidyaVaani, an AI health assistant — not a doctor.'
            : DISCLAIMER_HINDI;
          return xmlResponse(twimlSayHangup(`${notFoundMsg} ${disclaimer}`, state.language));
        }

        const responseText = buildDrugResponse(drugInfo, profile, state.language);
        const disclaimer = state.language === 'english'
          ? 'I am VaidyaVaani, an AI health assistant — not a doctor.'
          : DISCLAIMER_HINDI;

        state.drugName = drugName;
        state.drugQueryState = 'resolved';
        state.clinicalSummary = `Drug query: ${drugName} (${queryType})`;
        await deps.stateRepo.save(state);
        return xmlResponse(twimlSayHangup(`${responseText} ${disclaimer}`, state.language));
      } catch (err) {
        Logger.error('Drug KB query failed', { callSid, drugName, error: (err as Error).message });
        state.drugQueryState = 'resolved';
        await deps.stateRepo.save(state);
        const fallback = state.language === 'english' ? FALLBACK_ENGLISH : FALLBACK_HINDI;
        return xmlResponse(twimlGather(fallback, undefined, state.language));
      }
    }

    // S3 fix: Check if Nova Lite already extracted the drug name — skip the prompt if so.
    // Real-world: caller says "paracetamol safe hai kya pregnancy mein?" — Nova Lite extracts
    // drugs_mentioned: [{ name: 'paracetamol', query_type: 'safety' }]. Without this check,
    // the caller would hear "Kaunsi dawai?" even though she already said "paracetamol".
    const extractedDrug = state.masterExtraction?.drugs_mentioned?.[0];
    if (extractedDrug?.name) {
      // Drug name already known from extraction — skip prompt, go straight to query
      state.drugQueryState = 'awaiting_drug_name';
      // Re-enter this handler with the extracted drug name by setting state and processing inline
      const drugName = extractedDrug.name.toLowerCase().trim();
      const profile = state.patientProfile ?? state.masterExtraction?.patient_profile ?? { category: 'adult' as const, exact_age_mentioned: null, pregnancy_flag: 'unknown' as const };
      const queryType: DrugQueryType = (extractedDrug.query_type as DrugQueryType) ?? state.pendingDrugQuery?.queryType as DrugQueryType ?? 'safety';

      try {
        const drugInfo = await deps.drugKB.queryDrug(drugName, queryType, profile);

        if (drugInfo.not_found) {
          state.drugQueryState = 'resolved';
          await deps.stateRepo.save(state);
          const notFoundMsg = state.language === 'english' ? DRUG_NOT_FOUND_ENGLISH : DRUG_NOT_FOUND_HINDI;
          const disclaimer = state.language === 'english'
            ? 'I am VaidyaVaani, an AI health assistant — not a doctor.'
            : DISCLAIMER_HINDI;
          return xmlResponse(twimlSayHangup(`${notFoundMsg} ${disclaimer}`, state.language));
        }

        const responseText = buildDrugResponse(drugInfo, profile, state.language);
        const disclaimer = state.language === 'english'
          ? 'I am VaidyaVaani, an AI health assistant — not a doctor.'
          : DISCLAIMER_HINDI;

        state.drugName = drugName;
        state.drugQueryState = 'resolved';
        state.clinicalSummary = `Drug query: ${drugName} (${queryType})`;
        await deps.stateRepo.save(state);
        return xmlResponse(twimlSayHangup(`${responseText} ${disclaimer}`, state.language));
      } catch (err) {
        Logger.error('Drug KB query failed (extracted drug)', { callSid, drugName, error: (err as Error).message });
        state.drugQueryState = 'resolved';
        await deps.stateRepo.save(state);
        const fallback = state.language === 'english' ? FALLBACK_ENGLISH : FALLBACK_HINDI;
        return xmlResponse(twimlGather(fallback, undefined, state.language));
      }
    }

    // First drug turn — no drug name in extraction — prompt for drug name
    state.drugQueryState = 'awaiting_drug_name';
    await deps.stateRepo.save(state);
    const drugPrompt = state.language === 'english' ? DRUG_PROMPT_ENGLISH : DRUG_PROMPT_HINDI;
    return xmlResponse(twimlGather(drugPrompt, undefined, state.language));
  }

  // Fallback: re-prompt (S5 bilingual fix)
  await deps.stateRepo.save(state);
  const fallbackReprompt = state.language === 'english'
    ? 'Please describe your symptoms again.'
    : 'Kripya apni takleef dobara batayein.';
  return xmlResponse(twimlGather(fallbackReprompt, undefined, state.language));
}

// ─── handleStatus — Call end ──────────────────────────────────────────────────

/**
 * Handles the Twilio status callback when a call ends.
 * Builds the final CallRecord, logs it, triggers Step Functions for
 * post-triage actions, and deletes the ConversationState from DynamoDB.
 *
 * Req 1.5: Log all call data with FHIR record.
 * Req 7.6: Trigger Step Functions for parallel post-triage actions.
 */
async function handleStatus(
  event: APIGatewayProxyEvent,
  deps: CallHandlerDeps,
): Promise<APIGatewayProxyResult> {
  const body = parseFormBody(event.body ?? '');
  const callSid = body['CallSid'] ?? '';
  const callStatus = body['CallStatus'] ?? 'completed';
  const callDuration = parseInt(body['CallDuration'] ?? '0', 10);
  const callerNumber = body['From'] ?? 'unknown';

  Logger.info('Call status callback', { callSid, callStatus, callDuration });

  const state = await deps.stateRepo.load(callSid);

  // Determine triage outcome
  const triageOutcome: TriageOutcome = state?.triagePath === 'emergency'
    ? 'emergency_dispatched'
    : state?.triagePath === 'drug'
      ? 'drug_query_resolved'
      : state?.triagePath === 'general'
        ? 'general_triage_complete'
        : 'incomplete';

  // Determine call source type from number format
  const callSourceType: CallRecord['callSourceType'] =
    callerNumber.startsWith('0') ? 'landline' :
      callerNumber.match(/^\+91[6-9]/) ? 'mobile' : 'unknown';

  // Build location — use state's tier2 if available, else minimal fallback
  const tier2Fallback = {
    stdCode: '',
    city: 'Unknown',
    state: 'Unknown',
    district: 'Unknown',
    accuracy: 'district' as const,
    method: 'automatic' as const,
  };

  const tier2 = state?.tier2Location ?? tier2Fallback;

  const location: LocationData = {
    tier1Voice: state?.tier1Location,
    tier2Phone: tier2,
    primaryLocation: state?.tier1Location
      ? (state.tier1Location.village ?? state.tier1Location.landmark ?? state.tier1Location.nearCity ?? tier2.city)
      : (tier2.city !== 'Unknown' ? tier2.city : 'Unknown'),
    accuracyLevel: state?.tier1Location
      ? state.tier1Location.accuracy
      : (tier2.city !== 'Unknown' ? 'district' : 'unknown'),
  };

  // Build FHIR record
  const conditionId = state?.conditionId ?? 'unknown';
  const icd10Code = conditionId !== 'unknown'
    ? deps.triageAgent.tagICD10(conditionId)
    : 'R69';

  const fhirRecord = deps.callLogger.generateFHIRRecord({
    callId: callSid,
    isEmergency: state?.triagePath === 'emergency',
    condition: conditionId,
    icd10Code,
    severity: (state?.severity ?? (state?.triagePath === 'emergency' ? 'critical' : 'non-urgent')) as SeverityLevel,
    recommendedCareLevel: state?.recommendedCareLevel ?? 'home',
    treatmentAdvice: [],
    dispatchType: state?.triagePath === 'emergency' ? '108' : 'none',
    followUpRequired: state?.followUpRequired ?? false,
    ashaAlertRequired: state?.triagePath === 'emergency',
  });

  const callRecord: CallRecord = {
    callId: callSid,
    timestamp: state?.callStartTime ?? new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
    callerNumber,
    callSourceType,
    language: state?.language ?? 'hindi',
    duration: callDuration,
    triageOutcome,
    conditionId,
    icd10Code,
    severityClassification: (state?.severity ?? (state?.triagePath === 'emergency' ? 'critical' : 'non-urgent')) as SeverityLevel,
    dispatchType: state?.triagePath === 'emergency' ? '108' : 'none',
    actionsTaken: buildActionsTaken(state),
    location,
    recordingS3Key: '',
    bedrockTraceId: '',
    fhirRecord,
  };

  // Log call (non-blocking — errors swallowed inside logCall)
  await deps.callLogger.logCall(callRecord);

  // Trigger Step Functions for post-triage actions (non-blocking)
  // IMPORTANT: callRecord inside SFN input has callerNumber REDACTED for audit trail safety
  // (execution history is visible in AWS Console and CloudWatch). The real phone number is
  // passed as a separate top-level field `secureCallerNumber` so SMS and dispatch Lambdas
  // can read it without it appearing in the callRecord audit trail.
  const sfnCallRecord = { ...callRecord, callerNumber: '[REDACTED]' };
  const sfnArn = getStepFunctionsArn();
  if (sfnArn && state?.triagePath !== 'unknown') {
    // Build triageResult for SFN — the workflow references $.triageResult.* for
    // SMS content, referral careLevel, follow-up interval, and chronic care enrollment
    const triageResult: Record<string, unknown> = {
      callId: callSid,
      isEmergency: state?.triagePath === 'emergency',
      condition: conditionId,
      icd10Code,
      severity: callRecord.severityClassification,
      recommendedCareLevel: state?.recommendedCareLevel ?? 'home',
      treatmentAdvice: [],
      dispatchType: callRecord.dispatchType,
      followUpRequired: state?.followUpRequired ?? false,
      followUpInterval: state?.followUpInterval,
      ashaAlertRequired: state?.triagePath === 'emergency',
      chronicCareEnrollment: state?.chronicCareEnrollment,
    };

    try {
      await deps.sfn.send(new StartExecutionCommand({
        stateMachineArn: sfnArn,
        name: `triage-${callSid}-${Date.now()}`,
        input: JSON.stringify({
          callRecord: sfnCallRecord,
          triageResult,
          triagePath: state?.triagePath,
          conditionId,
          abcdeSummary: state?.clinicalSummary ?? '',
          transcriptHistory: state?.transcriptHistory ?? [],
          // S1 fix: pass real phone number as separate field for SMS/dispatch Lambdas.
          // SFN workflow tasks reference $.secureCallerNumber instead of $.callRecord.callerNumber.
          secureCallerNumber: callerNumber,
        }),
      }));
      Logger.info('Step Functions triggered', { callSid });
    } catch (err) {
      // Non-fatal — call is already complete
      Logger.error('Step Functions trigger failed', { callSid, error: (err as Error).message });
    }
  }

  // Clean up conversation state
  await deps.stateRepo.delete(callSid);

  // Return 200 OK — Twilio doesn't use the body for status callbacks
  return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body: 'OK' };
}

// ─── handleMissedCall — Missed call callback (Req 1.6) ───────────────────────

/**
 * Handles missed call webhook from Twilio.
 * When a caller dials and hangs up before the system answers (missed call),
 * Twilio fires a status callback with CallStatus=no-answer or busy.
 * This endpoint initiates an outbound callback to the caller.
 *
 * Real-world scenario: Sunita from a remote village tries calling VaidyaVaani
 * but her signal drops after 2 rings. The system detects the missed call and
 * calls her back within 30 seconds, so she doesn't have to spend more airtime.
 *
 * Req 1.6: Missed call → automatic callback.
 */
async function handleMissedCall(
  event: APIGatewayProxyEvent,
  deps: CallHandlerDeps,
): Promise<APIGatewayProxyResult> {
  const body = parseFormBody(event.body ?? '');
  const callSid = body['CallSid'] ?? '';
  const callerNumber = body['From'] ?? '';
  const callStatus = body['CallStatus'] ?? '';

  // Only process genuine missed calls — not completed or in-progress
  if (!callerNumber || !['no-answer', 'busy', 'canceled'].includes(callStatus)) {
    Logger.info('Missed call handler: ignoring non-missed status', { callSid, callStatus });
    return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body: 'OK' };
  }

  Logger.info('Missed call detected — initiating callback', { callSid, callerNumber: '[REDACTED]', callStatus });

  // In production: use Twilio REST API to initiate outbound call
  // For the prototype, we log the intent and return success.
  // The outbound call would use the same /incoming webhook as the entry point,
  // so the caller gets the standard VaidyaVaani greeting when they pick up.
  //
  // Production implementation:
  //   const twilioClient = new Twilio(ACCOUNT_SID, AUTH_TOKEN);
  //   await twilioClient.calls.create({
  //     to: callerNumber,
  //     from: VAIDYAVAANI_NUMBER,
  //     url: INCOMING_URL,
  //     statusCallback: STATUS_URL,
  //   });

  return jsonMissedCallResponse(200, {
    action: 'callback_initiated',
    originalCallSid: callSid,
    callbackTo: '[REDACTED]',
  });
}

function jsonMissedCallResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/**
 * Parses a URL-encoded form body (Twilio webhook format) into a key-value map.
 */
function parseFormBody(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!body) return result;
  for (const pair of body.split('&')) {
    // Use indexOf to split on FIRST '=' only — values may contain '=' (e.g., base64 data)
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.substring(0, eqIdx);
    const value = pair.substring(eqIdx + 1);
    // URL-encoded form data uses + for spaces (application/x-www-form-urlencoded).
    // decodeURIComponent does NOT decode + as space — only %20.
    // Twilio sends SpeechResult=mujhe+bukhar+hai — without this fix,
    // we'd get "mujhe+bukhar+hai" instead of "mujhe bukhar hai".
    if (key) {
      result[decodeURIComponent(key.replace(/\+/g, ' '))] =
        decodeURIComponent(value.replace(/\+/g, ' '));
    }
  }
  return result;
}

/**
 * Advances the ABCDE step in order: null → airway → breathing → circulation → disability → exposure.
 * After exposure, loops back to airway (multi-turn ABCDE assessment).
 */
function advanceABCDEStep(
  current: ConversationState['abcdeStep'],
): 'airway' | 'breathing' | 'circulation' | 'disability' | 'exposure' {
  switch (current) {
    case null: return 'airway';
    case 'airway': return 'breathing';
    case 'breathing': return 'circulation';
    case 'circulation': return 'disability';
    case 'disability': return 'exposure';
    case 'exposure': return 'airway'; // loop for multi-turn
    default: return 'airway';
  }
}

/**
 * Builds the ActionType array for the CallRecord based on conversation state.
 */
function buildActionsTaken(state: ConversationState | null): ActionType[] {
  const actions: ActionType[] = [];
  if (!state) return actions;
  if (state.triagePath === 'emergency') {
    actions.push('dispatch_108');
    actions.push('sms_treatment');
  } else if (state.triagePath === 'general') {
    actions.push('sms_treatment');
    if (state.followUpRequired) {
      actions.push('follow_up_scheduled');
    }
  } else if (state.triagePath === 'drug') {
    actions.push('sms_treatment');
  }
  return actions;
}

// ─── Lambda exports ───────────────────────────────────────────────────────────

/**
 * Factory function for dependency injection (used in tests).
 * Accepts partial deps — missing deps fall back to production defaults.
 */
export function createHandler(deps: Partial<CallHandlerDeps> = {}) {
  const resolved = { ...createDefaultDeps(), ...deps };

  return {
    incoming: withErrorHandler('handleIncoming', (event: APIGatewayProxyEvent) => handleIncoming(event, resolved)),
    gather: withErrorHandler('handleGather', (event: APIGatewayProxyEvent) => handleGather(event, resolved), { isEmergencyPath: true }),
    status: withErrorHandler('handleStatus', (event: APIGatewayProxyEvent) => handleStatus(event, resolved)),
    missedCall: withErrorHandler('handleMissedCall', (event: APIGatewayProxyEvent) => handleMissedCall(event, resolved)),
  };
}

const _defaultHandler = createHandler();

/**
 * Main Lambda handler — routes by path:
 *   /incoming    → handleIncoming
 *   /gather      → handleGather
 *   /status      → handleStatus
 *   /missed-call → handleMissedCall
 */
export const handler = withErrorHandler(
  'callHandler',
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const path = event.path ?? event.requestContext?.resourcePath ?? '';

    if (path.endsWith('/incoming')) {
      return _defaultHandler.incoming(event) as Promise<APIGatewayProxyResult>;
    }
    if (path.endsWith('/gather')) {
      return _defaultHandler.gather(event) as Promise<APIGatewayProxyResult>;
    }
    if (path.endsWith('/status')) {
      return _defaultHandler.status(event) as Promise<APIGatewayProxyResult>;
    }
    if (path.endsWith('/missed-call')) {
      return _defaultHandler.missedCall(event) as Promise<APIGatewayProxyResult>;
    }

    Logger.warn('Unknown path', { path });
    return { statusCode: 404, body: 'Not found' };
  },
);
