import * as fc from 'fast-check';
import { IntentRouterService } from '../../services/intentRouter';
import { ClassificationInput, ConversationContext } from '../../models/types';

const router = new IntentRouterService();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeContext = (history: string[] = []): ConversationContext => ({
  callId: 'test-call-001',
  turn: 1,
  triagePath: 'unknown',
  transcriptHistory: history,
  dangerSignsDetected: [],
  patientProfile: null,
  masterExtraction: null,
});

const makeInput = (text: string, dtmfKey?: number): ClassificationInput => ({
  transcribedText: text,
  language: 'hindi',
  dtmfKey,
});

// ─── Property 1: Intent routing correctness ──────────────────────────────────

describe('Property 1: Intent routing correctness', () => {

  // DTMF 9 always emergency
  test('DTMF key 9 always routes to emergency', async () => {
    fc.assert(
      fc.asyncProperty(fc.string(), async (text) => {
        const result = await router.classifyIntent(makeInput(text, 9));
        return result.intent === 'emergency' && result.triggerType === 'dtmf';
      }),
      { numRuns: 100 }
    );
  });

  // Known Hindi emergency keywords (≤4 words) → emergency
  test('Hindi emergency keywords route to emergency', async () => {
    const emergencyPhrases = [
      'seene mein dard',
      'dil ka dora',
      'saanp ne kaata',
      'saans nahi aa rahi',
      'bachcha behosh',
    ];
    for (const phrase of emergencyPhrases) {
      const result = await router.classifyIntent(makeInput(phrase));
      expect(result.intent).toBe('emergency');
      expect(result.triggerType).toBe('keyword');
    }
  });

  // Known English emergency keywords (≤4 words) → emergency
  test('English emergency keywords route to emergency', async () => {
    const emergencyPhrases = [
      'heart attack',
      'chest pain',
      'snake bite',
      'cannot breathe',
      'breathing problem',
    ];
    for (const phrase of emergencyPhrases) {
      const result = await router.classifyIntent(makeInput(phrase));
      expect(result.intent).toBe('emergency');
    }
  });

  // SOS words → emergency
  test('SOS words route to emergency', async () => {
    const sosPhrases = ['help', 'bachao', 'emergency', 'ambulance'];
    for (const phrase of sosPhrases) {
      const result = await router.classifyIntent(makeInput(phrase));
      expect(result.intent).toBe('emergency');
    }
  });

  // Long utterances (>4 words) with emergency keywords → general_triage
  // (Nova Lite handles these — keyword scan is skipped)
  test('Long utterances with emergency keywords skip keyword scan → general_triage', async () => {
    const longPhrases = [
      'mujhe seene mein dard nahi hai',           // negation
      'kal mere bhai ko seene mein dard tha',     // past tense + third party
      'mere dost ko chest pain tha kal raat',     // past tense
      'kya heart attack ke symptoms kya hote hain', // question
    ];
    for (const phrase of longPhrases) {
      const result = await router.classifyIntent(makeInput(phrase));
      expect(result.intent).toBe('general_triage');
    }
  });

  // Non-emergency input → general_triage
  test('Non-emergency input routes to general_triage', async () => {
    const nonEmergency = [
      'bukhar hai',
      'sir dard ho raha hai',
      'khaasi aa rahi hai',
      'pet mein dard',
    ];
    for (const phrase of nonEmergency) {
      const result = await router.classifyIntent(makeInput(phrase));
      expect(result.intent).toBe('general_triage');
    }
  });

  // Property: any input without emergency indicators → general_triage
  test('Random non-emergency strings route to general_triage', async () => {
    // Generate strings that don't contain any emergency keywords
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }).filter(s =>
          !['heart attack', 'chest pain', 'snake bite', 'seene mein dard',
            'saanp ne kaata', 'saans nahi', 'bachcha behosh', 'help',
            'bachao', 'emergency', 'ambulance', 'sos', 'cannot breathe',
            'breathing problem', 'dil ka dora', 'dam ghut', 'naag ne kaata',
            'child fever', 'baby fits', 'tez bukhar',
            'chest mein pain', 'dil attack', 'saanp bite', 'saanp ne bite',
            'snake ne kaata', 'breathing nahi', 'bachche ko fever',
            'baby ko bukhar', 'bachche ko'
          ].some(kw => s.toLowerCase().includes(kw))
        ),
        async (text) => {
          const result = await router.classifyIntent({ transcribedText: text, language: 'hindi' });
          return result.intent === 'general_triage';
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 2: Danger sign mid-call escalation ─────────────────────────────

describe('Property 2: Danger sign mid-call escalation', () => {

  test('Danger signs in transcript history trigger emergency re-route', async () => {
    const dangerSignContexts = [
      makeContext(['bukhar hai', 'ab behosh ho gaya']),
      makeContext(['sir dard', 'saans nahi le pa raha']),
      makeContext(['pet dard', 'bahut khoon aa raha hai']),
      makeContext(['khaasi', 'convulsion aa gaya']),
    ];
    for (const ctx of dangerSignContexts) {
      const result = await router.classifyIntent({
        transcribedText: 'kuch nahi',
        language: 'hindi',
        conversationContext: ctx,
      });
      expect(result.intent).toBe('emergency');
      expect(result.triggerType).toBe('danger_sign');
    }
  });

  test('checkDangerSigns returns true for known danger sign patterns', () => {
    const dangerContexts = [
      makeContext(['ab behosh ho gaya']),
      makeContext(['saans nahi aa rahi']),
      makeContext(['seizure aa gaya']),
      makeContext(['jhatkay aa rahe hain']),
    ];
    for (const ctx of dangerContexts) {
      expect(router.checkDangerSigns(ctx)).toBe(true);
    }
  });

  test('checkDangerSigns returns false for normal conversation', () => {
    const normalContexts = [
      makeContext(['bukhar hai teen din se']),
      makeContext(['sir mein dard hai']),
      makeContext(['khaasi aa rahi hai']),
    ];
    for (const ctx of normalContexts) {
      expect(router.checkDangerSigns(ctx)).toBe(false);
    }
  });

  test('Danger sign in CURRENT utterance (not yet in history) still triggers escalation', async () => {
    // Simulates: Turn 3, caller says "ab behosh ho gaya" but call handler hasn't
    // appended it to transcriptHistory yet. The intent router must still catch it.
    const ctx = makeContext(['bukhar hai', 'teen din se hai']);  // no danger signs in history
    const result = await router.classifyIntent({
      transcribedText: 'ab behosh ho gaya',   // danger sign is HERE
      language: 'hindi',
      conversationContext: ctx,
    });
    expect(result.intent).toBe('emergency');
    expect(result.triggerType).toBe('danger_sign');
  });

  test('checkDangerSigns with currentUtterance param catches danger sign not in history', () => {
    const ctx = makeContext(['bukhar hai']);
    expect(router.checkDangerSigns(ctx)).toBe(false);                          // without current utterance
    expect(router.checkDangerSigns(ctx, 'ab behosh ho gaya')).toBe(true);      // with current utterance
  });
});
