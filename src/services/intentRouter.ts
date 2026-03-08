import {
  ClassificationInput, IntentResult, KeywordMatch,
  ConversationContext, MasterExtractionResult
} from '../models/types';
import { Language, CONFIDENCE_THRESHOLD } from '../models/enums';
import { IIntentRouter } from '../interfaces/IIntentRouter';
import { Logger } from '../utils/logger';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// ─── Emergency Keyword Dictionary ────────────────────────────────────────────

const EMERGENCY_KEYWORDS: Record<string, { conditionId: string; language: Language }[]> = {
  // Cardiac — Hindi
  'seene mein dard':     [{ conditionId: 'cardiac', language: 'hindi' }],
  'dil ka dora':         [{ conditionId: 'cardiac', language: 'hindi' }],
  // Cardiac — English
  'heart attack':        [{ conditionId: 'cardiac', language: 'english' }],
  'chest pain':          [{ conditionId: 'cardiac', language: 'english' }],
  // Cardiac — Hinglish
  'heart attack ho raha':[{ conditionId: 'cardiac', language: 'hindi' }],
  'chest mein pain':     [{ conditionId: 'cardiac', language: 'hindi' }],
  'dil attack':          [{ conditionId: 'cardiac', language: 'hindi' }],

  // Snakebite — Hindi
  'saanp ne kaata':      [{ conditionId: 'snakebite', language: 'hindi' }],
  'naag ne kaata':       [{ conditionId: 'snakebite', language: 'hindi' }],
  // Snakebite — English
  'snake bite':          [{ conditionId: 'snakebite', language: 'english' }],
  // Snakebite — Hinglish
  'saanp bite':          [{ conditionId: 'snakebite', language: 'hindi' }],
  'saanp ne bite kiya':  [{ conditionId: 'snakebite', language: 'hindi' }],
  'snake ne kaata':      [{ conditionId: 'snakebite', language: 'hindi' }],

  // Breathing difficulty — Hindi
  'saans nahi aa rahi':  [{ conditionId: 'breathing_difficulty', language: 'hindi' }],
  'dam ghut raha':       [{ conditionId: 'breathing_difficulty', language: 'hindi' }],
  // Breathing difficulty — English
  "can't breathe":       [{ conditionId: 'breathing_difficulty', language: 'english' }],
  'cannot breathe':      [{ conditionId: 'breathing_difficulty', language: 'english' }],
  'breathing problem':   [{ conditionId: 'breathing_difficulty', language: 'english' }],
  // Breathing difficulty — Hinglish
  'saans nahi le pa raha': [{ conditionId: 'breathing_difficulty', language: 'hindi' }],
  'breathing nahi ho rahi': [{ conditionId: 'breathing_difficulty', language: 'hindi' }],

  // Child fever — Hindi
  'bachche ko tez bukhar': [{ conditionId: 'child_fever', language: 'hindi' }],
  'bachcha behosh':        [{ conditionId: 'child_fever', language: 'hindi' }],
  // Child fever — English
  'child fever':           [{ conditionId: 'child_fever', language: 'english' }],
  'baby fits':             [{ conditionId: 'child_fever', language: 'english' }],
  // Child fever — Hinglish
  'bachche ko fever':      [{ conditionId: 'child_fever', language: 'hindi' }],
  'baby ko bukhar':        [{ conditionId: 'child_fever', language: 'hindi' }],
};

// SOS activation words — single word emergency trigger
const SOS_WORDS = ['help', 'bachao', 'emergency', 'ambulance', 'sos'];

// Danger signs for mid-call escalation monitoring
const DANGER_SIGN_PATTERNS = [
  'behosh', 'unconscious', 'saans nahi', 'not breathing', 'seizure',
  'convulsion', 'jhatkay', 'bleeding heavily', 'bahut khoon',
  'stroke', 'paralysis', 'laqwa', 'anaphylaxis', 'severe allergy',
];

// ─── Intent Router Service ────────────────────────────────────────────────────

export class IntentRouterService implements IIntentRouter {

  private bedrock: BedrockRuntimeClient;

  constructor(bedrock?: BedrockRuntimeClient) {
    this.bedrock = bedrock ?? new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'ap-south-1' });
  }

  /**
   * Stage 1: Keyword scan — only for short utterances (≤4 words).
   * Returns null if no match or utterance is too long.
   */
  checkEmergencyKeywords(text: string, language: Language): KeywordMatch | null {
    const normalized = text.toLowerCase().trim();
    const wordCount = normalized.split(/\s+/).length;

    // Guard: skip keyword scan for long utterances to prevent false positives
    // (negations, past tense, third-party references)
    if (wordCount > 4) {
      return null;
    }

    // Check SOS words first (single word)
    for (const sos of SOS_WORDS) {
      if (normalized.includes(sos)) {
        return { matched: true, keyword: sos, conditionId: 'emergency', language };
      }
    }

    // Check emergency keyword dictionary
    for (const [keyword, mappings] of Object.entries(EMERGENCY_KEYWORDS)) {
      if (normalized.includes(keyword)) {
        return {
          matched: true,
          keyword,
          conditionId: mappings[0].conditionId,
          language: mappings[0].language,
        };
      }
    }

    return null;
  }

  /**
   * Mid-call danger sign monitoring.
   * Returns true if any danger sign pattern is found in conversation history
   * OR in the current utterance.
   */
  checkDangerSigns(context: ConversationContext, currentUtterance?: string): boolean {
    // Include current utterance so danger signs are caught even if the call handler
    // hasn't appended it to transcriptHistory yet (defensive — no ordering dependency)
    const parts = [...context.transcriptHistory];
    if (currentUtterance) {
      parts.push(currentUtterance);
    }
    const allText = parts.join(' ').toLowerCase();
    return DANGER_SIGN_PATTERNS.some(pattern => allText.includes(pattern));
  }

  /**
   * Main classification — 3-stage cascade.
   * Stage 1: keyword scan (5ms, no LLM)
   * Stage 2: Nova Lite Master Extraction (~150ms) — fired in parallel with Stage 1
   * Stage 3: Nova Pro safety check (only for low-confidence emergencies)
   */
  async classifyIntent(input: ClassificationInput): Promise<IntentResult> {
    const { transcribedText, language, dtmfKey, emotionResult, conversationContext } = input;

    // DTMF key 9 — silent emergency override, highest priority
    if (dtmfKey === 9) {
      Logger.info('DTMF 9 emergency override', { callId: conversationContext?.callId });
      return { intent: 'emergency', confidence: 1.0, triggerType: 'dtmf' };
    }

    // Emotion detection — panic/distress escalates to emergency
    // NOTE (Prototype): This code path is DEAD in the Twilio+Polly prototype.
    // Twilio only provides transcribed text, not audio emotion analysis.
    // Emotion detection requires Nova 2 Sonic (production: Amazon Connect),
    // which analyzes voice tone in real-time to detect panic/distress/calm.
    // This code is kept for production readiness — it will activate when
    // we switch to Connect + Nova Sonic. For the hackathon demo, emergency
    // detection relies on keyword scan + Nova Lite Master Extraction only.
    if (emotionResult?.emotion === 'panic' || emotionResult?.emotion === 'distress') {
      if (emotionResult.confidence >= CONFIDENCE_THRESHOLD) {
        Logger.info('Emotion escalation to emergency', { emotion: emotionResult.emotion });
        return { intent: 'emergency', confidence: emotionResult.confidence, triggerType: 'emotion' };
      }
    }

    // Mid-call danger sign monitoring (includes current utterance — no ordering dependency on call handler)
    if (conversationContext && this.checkDangerSigns(conversationContext, transcribedText)) {
      Logger.info('Danger signs detected mid-call', { callId: conversationContext.callId });
      return { intent: 'emergency', confidence: 0.9, triggerType: 'danger_sign' };
    }

    // Stage 1 + Stage 2 in parallel via Promise.race() for emergency detection
    const keywordResult = this.checkEmergencyKeywords(transcribedText, language);

    if (keywordResult?.matched) {
      Logger.info('Stage 1 keyword match', { keyword: keywordResult.keyword });
      return {
        intent: 'emergency',
        confidence: 1.0,
        triggerType: 'keyword',
        matchedKeywords: keywordResult.keyword ? [keywordResult.keyword] : [],
        conditionId: keywordResult.conditionId ?? undefined,
      };
    }

    // No keyword match — return general_triage
    // (Nova Lite Master Extraction is called by the call handler, not here —
    //  this service handles the routing decision after extraction is done)
    Logger.info('No emergency indicators — routing to general triage');
    return { intent: 'general_triage', confidence: 0.8, triggerType: 'default' };
  }

  /**
   * Route from a completed MasterExtractionResult.
   * Called by the call handler after Nova Lite returns.
   */
  routeFromExtraction(extraction: MasterExtractionResult): IntentResult {
    // Overdose always routes to emergency regardless of is_emergency flag
    const hasOverdose = extraction.drugs_mentioned.some(d => d.query_type === 'overdose');
    if (hasOverdose) {
      return { intent: 'emergency', confidence: 1.0, triggerType: 'keyword', matchedKeywords: ['overdose'], conditionId: extraction.condition_id };
    }

    // Detect non-overdose drug queries — may become pendingDrugQuery if emergency wins
    const nonOverdoseDrug = extraction.drugs_mentioned.find(
      d => d.query_type === 'safety' || d.query_type === 'dosage' || d.query_type === 'availability'
    );

    // danger_signs_present non-empty → emergency escalation regardless of is_emergency (Req 2.6, design.md routing rules)
    if (extraction.danger_signs_present.length > 0) {
      Logger.info('Danger signs in extraction — escalating to emergency', { dangerSigns: extraction.danger_signs_present });
      const lowConfidence = extraction.confidence < CONFIDENCE_THRESHOLD;
      return {
        intent: 'emergency',
        confidence: Math.max(extraction.confidence, 0.9),
        triggerType: 'danger_sign',
        conditionId: extraction.condition_id,
        ...(lowConfidence && { needsSafetyCheck: true }),
        pendingDrugQuery: nonOverdoseDrug ? { drugName: nonOverdoseDrug.name, queryType: nonOverdoseDrug.query_type } : undefined,
      };
    }

    // Drug safety/dosage query with NO emergency → Drug KB (Req 2.10)
    if (nonOverdoseDrug && !extraction.is_emergency) {
      return { intent: 'drug', confidence: extraction.confidence, triggerType: 'default', conditionId: extraction.condition_id };
    }

    if (extraction.is_emergency) {
      // Build pending drug query if caller also asked about a drug
      const pending = nonOverdoseDrug ? { drugName: nonOverdoseDrug.name, queryType: nonOverdoseDrug.query_type } : undefined;

      if (extraction.confidence >= CONFIDENCE_THRESHOLD) {
        return { intent: 'emergency', confidence: extraction.confidence, triggerType: 'default', conditionId: extraction.condition_id, pendingDrugQuery: pending };
      }
      // Low confidence — still emergency but flagged for Nova Pro safety check
      return { intent: 'emergency', confidence: extraction.confidence, triggerType: 'default', needsSafetyCheck: true, conditionId: extraction.condition_id, pendingDrugQuery: pending };
    }

    return { intent: 'general_triage', confidence: extraction.confidence, triggerType: 'default', conditionId: extraction.condition_id };
  }

  /**
   * Stage 2: Nova Lite Master Extraction (~150ms).
   * Converts raw caller speech into the locked MasterExtractionResult JSON.
   * This is the unified routing contract for all downstream paths.
   *
   * Uses amazon.nova-lite-v1:0 with a structured JSON prompt.
   * On failure, returns a safe default (general_triage, no emergency).
   */
  async extractMasterTags(utterance: string, language: Language): Promise<MasterExtractionResult> {
    const prompt = `You are a medical triage classifier for an Indian health helpline.
Analyze the caller's utterance and return ONLY a JSON object with these fields:
- is_emergency (boolean): true if life-threatening
- condition_id (string): one of "cardiac","snakebite","child_fever","breathing_difficulty","general_fever","maternal_care","chronic_disease","drug_query","unknown"
- patient_profile: { category: "pediatric"|"adult"|"maternal"|"geriatric"|"unknown", exact_age_mentioned: string|null, pregnancy_flag: "confirmed"|"possible"|"not_applicable"|"unknown" }
- clinical_symptoms_english (string[]): symptoms translated to English
- drugs_mentioned: array of { name: string, query_type: "safety"|"dosage"|"overdose"|"availability" }
- severity_signal: "critical"|"urgent"|"mild"
- duration: string|null (e.g. "2 days")
- location_mentioned: string|null
- danger_signs_present: string[] (e.g. "unconscious","not breathing")
- confidence: number 0-1
- language_register: "pure_hindi"|"hinglish"|"english"

Caller language: ${language}
Caller said: "${utterance}"

Return ONLY valid JSON, no explanation.`;

    try {
      const response = await this.bedrock.send(new InvokeModelCommand({
        modelId: 'amazon.nova-lite-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          inputText: prompt,
          textGenerationConfig: {
            maxTokenCount: 512,
            temperature: 0.1,
            topP: 0.9,
          },
        }),
      }));

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const outputText = responseBody.results?.[0]?.outputText ?? responseBody.output?.text ?? '';

      // Extract JSON from response — Nova Lite may wrap it in markdown code blocks
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        Logger.warn('Nova Lite returned no JSON — falling back to default extraction', { utterance });
        return this._defaultExtraction(utterance, language);
      }

      const parsed = JSON.parse(jsonMatch[0]) as MasterExtractionResult;

      // Validate required fields — if missing, fill with safe defaults
      return {
        is_emergency: parsed.is_emergency ?? false,
        condition_id: parsed.condition_id ?? 'unknown',
        patient_profile: parsed.patient_profile ?? { category: 'adult', exact_age_mentioned: null, pregnancy_flag: 'unknown' },
        clinical_symptoms_english: parsed.clinical_symptoms_english ?? [],
        drugs_mentioned: parsed.drugs_mentioned ?? [],
        severity_signal: parsed.severity_signal ?? 'mild',
        duration: parsed.duration ?? null,
        location_mentioned: parsed.location_mentioned ?? null,
        danger_signs_present: parsed.danger_signs_present ?? [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        language_register: parsed.language_register ?? 'hinglish',
      };
    } catch (err) {
      Logger.error('Nova Lite extraction failed — using default', { error: (err as Error).message, utterance });
      return this._defaultExtraction(utterance, language);
    }
  }

  /**
   * Safe default extraction when Nova Lite is unavailable.
   * Returns non-emergency general_triage so the caller still gets help.
   */
  private _defaultExtraction(utterance: string, language: Language): MasterExtractionResult {
    return {
      is_emergency: false,
      condition_id: 'unknown',
      patient_profile: { category: 'adult', exact_age_mentioned: null, pregnancy_flag: 'unknown' },
      clinical_symptoms_english: [utterance],
      drugs_mentioned: [],
      severity_signal: 'mild',
      duration: null,
      location_mentioned: null,
      danger_signs_present: [],
      confidence: 0.3,
      language_register: language === 'english' ? 'english' : 'hinglish',
    };
  }
}
