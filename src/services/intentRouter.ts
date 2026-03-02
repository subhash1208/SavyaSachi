import {
  ClassificationInput, IntentResult, KeywordMatch,
  ConversationContext, MasterExtractionResult
} from '../models/types';
import { Language, CONFIDENCE_THRESHOLD } from '../models/enums';
import { IIntentRouter } from '../interfaces/IIntentRouter';
import { Logger } from '../utils/logger';

// ─── Emergency Keyword Dictionary ────────────────────────────────────────────

const EMERGENCY_KEYWORDS: Record<string, { conditionId: string; language: Language }[]> = {
  // Cardiac
  'seene mein dard':     [{ conditionId: 'cardiac', language: 'hindi' }],
  'dil ka dora':         [{ conditionId: 'cardiac', language: 'hindi' }],
  'heart attack':        [{ conditionId: 'cardiac', language: 'english' }],
  'chest pain':          [{ conditionId: 'cardiac', language: 'english' }],
  'heart attack ho raha':[{ conditionId: 'cardiac', language: 'hindi' }],

  // Snakebite
  'saanp ne kaata':      [{ conditionId: 'snakebite', language: 'hindi' }],
  'naag ne kaata':       [{ conditionId: 'snakebite', language: 'hindi' }],
  'snake bite':          [{ conditionId: 'snakebite', language: 'english' }],
  'saanp bite':          [{ conditionId: 'snakebite', language: 'hindi' }],

  // Breathing difficulty
  'saans nahi aa rahi':  [{ conditionId: 'breathing_difficulty', language: 'hindi' }],
  'dam ghut raha':       [{ conditionId: 'breathing_difficulty', language: 'hindi' }],
  "can't breathe":       [{ conditionId: 'breathing_difficulty', language: 'english' }],
  'cannot breathe':      [{ conditionId: 'breathing_difficulty', language: 'english' }],
  'breathing problem':   [{ conditionId: 'breathing_difficulty', language: 'english' }],

  // Child fever
  'bachche ko tez bukhar': [{ conditionId: 'child_fever', language: 'hindi' }],
  'bachcha behosh':        [{ conditionId: 'child_fever', language: 'hindi' }],
  'child fever':           [{ conditionId: 'child_fever', language: 'english' }],
  'baby fits':             [{ conditionId: 'child_fever', language: 'english' }],
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
   * Returns true if any danger sign pattern is found in conversation history.
   */
  checkDangerSigns(context: ConversationContext): boolean {
    const allText = context.transcriptHistory.join(' ').toLowerCase();
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
    if (emotionResult?.emotion === 'panic' || emotionResult?.emotion === 'distress') {
      if (emotionResult.confidence >= CONFIDENCE_THRESHOLD) {
        Logger.info('Emotion escalation to emergency', { emotion: emotionResult.emotion });
        return { intent: 'emergency', confidence: emotionResult.confidence, triggerType: 'emotion' };
      }
    }

    // Mid-call danger sign monitoring
    if (conversationContext && this.checkDangerSigns(conversationContext)) {
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
      return { intent: 'emergency', confidence: 1.0, triggerType: 'keyword', matchedKeywords: ['overdose'] };
    }

    // Drug safety/dosage query → Drug KB (Req 2.10)
    const hasDrugQuery = extraction.drugs_mentioned.some(
      d => d.query_type === 'safety' || d.query_type === 'dosage' || d.query_type === 'availability'
    );
    if (hasDrugQuery && !extraction.is_emergency) {
      return { intent: 'drug', confidence: extraction.confidence, triggerType: 'default' };
    }

    if (extraction.is_emergency) {
      if (extraction.confidence >= CONFIDENCE_THRESHOLD) {
        return { intent: 'emergency', confidence: extraction.confidence, triggerType: 'default' };
      }
      // Low confidence — still emergency but flagged for Nova Pro safety check
      return { intent: 'emergency', confidence: extraction.confidence, triggerType: 'default' };
    }

    return { intent: 'general_triage', confidence: extraction.confidence, triggerType: 'default' };
  }
}
