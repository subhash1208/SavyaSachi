import { IntentRouterService } from '../../services/intentRouter';
import { ClassificationInput, ConversationContext } from '../../models/types';

const router = new IntentRouterService();

const makeInput = (text: string, dtmfKey?: number, emotion?: { emotion: 'panic' | 'distress' | 'calm' | 'unknown'; confidence: number }): ClassificationInput => ({
  transcribedText: text,
  language: 'hindi',
  dtmfKey,
  emotionResult: emotion,
});

const makeContext = (history: string[]): ConversationContext => ({
  callId: 'unit-test-001',
  turn: 2,
  triagePath: 'general',
  transcriptHistory: history,
  dangerSignsDetected: [],
  patientProfile: null,
  masterExtraction: null,
});

// ─── Hindi Keywords ───────────────────────────────────────────────────────────

describe('Task 2.4: Unit tests — Hindi keywords', () => {
  test('"seene mein dard" → emergency (cardiac)', async () => {
    const result = await router.classifyIntent(makeInput('seene mein dard'));
    expect(result.intent).toBe('emergency');
    expect(result.triggerType).toBe('keyword');
  });

  test('"saans nahi aa rahi" → emergency (breathing_difficulty)', async () => {
    const result = await router.classifyIntent(makeInput('saans nahi aa rahi'));
    expect(result.intent).toBe('emergency');
    expect(result.triggerType).toBe('keyword');
  });

  test('"saanp ne kaata" → emergency (snakebite)', async () => {
    const result = await router.classifyIntent(makeInput('saanp ne kaata'));
    expect(result.intent).toBe('emergency');
    expect(result.triggerType).toBe('keyword');
  });

  test('"bachcha behosh" → emergency (child_fever)', async () => {
    const result = await router.classifyIntent(makeInput('bachcha behosh'));
    expect(result.intent).toBe('emergency');
    expect(result.triggerType).toBe('keyword');
  });

  test('"bachao" → emergency (SOS)', async () => {
    const result = await router.classifyIntent(makeInput('bachao'));
    expect(result.intent).toBe('emergency');
  });
});

// ─── Hinglish Keywords ────────────────────────────────────────────────────────

describe('Task 2.4: Unit tests — Hinglish keywords', () => {
  test('"breathing problem" → emergency', async () => {
    const result = await router.classifyIntent(makeInput('breathing problem'));
    expect(result.intent).toBe('emergency');
  });

  test('"heart attack ho raha" → emergency', async () => {
    const result = await router.classifyIntent(makeInput('heart attack ho raha'));
    expect(result.intent).toBe('emergency');
  });

  test('"saanp bite" → emergency', async () => {
    const result = await router.classifyIntent(makeInput('saanp bite'));
    expect(result.intent).toBe('emergency');
  });
});

// ─── DTMF 9 Override ─────────────────────────────────────────────────────────

describe('Task 2.4: Unit tests — DTMF 9 override', () => {
  test('DTMF 9 with non-emergency text → emergency', async () => {
    const result = await router.classifyIntent(makeInput('bukhar hai', 9));
    expect(result.intent).toBe('emergency');
    expect(result.triggerType).toBe('dtmf');
  });

  test('DTMF 9 with empty text → emergency', async () => {
    const result = await router.classifyIntent(makeInput('', 9));
    expect(result.intent).toBe('emergency');
    expect(result.triggerType).toBe('dtmf');
  });

  test('DTMF 2 (English) with no emergency text → general_triage', async () => {
    const result = await router.classifyIntent(makeInput('bukhar hai', 2));
    expect(result.intent).toBe('general_triage');
  });
});

// ─── SOS Word Detection ───────────────────────────────────────────────────────

describe('Task 2.4: Unit tests — SOS word detection', () => {
  test('"help" → emergency', async () => {
    const result = await router.classifyIntent(makeInput('help'));
    expect(result.intent).toBe('emergency');
  });

  test('"emergency" → emergency', async () => {
    const result = await router.classifyIntent(makeInput('emergency'));
    expect(result.intent).toBe('emergency');
  });

  test('"ambulance" → emergency', async () => {
    const result = await router.classifyIntent(makeInput('ambulance'));
    expect(result.intent).toBe('emergency');
  });
});

// ─── Emotion Detection Escalation ────────────────────────────────────────────

describe('Task 2.4: Unit tests — Emotion detection escalation', () => {
  test('Panic emotion with high confidence → emergency', async () => {
    const result = await router.classifyIntent(
      makeInput('kuch nahi', undefined, { emotion: 'panic', confidence: 0.9 })
    );
    expect(result.intent).toBe('emergency');
    expect(result.triggerType).toBe('emotion');
  });

  test('Distress emotion with high confidence → emergency', async () => {
    const result = await router.classifyIntent(
      makeInput('kuch nahi', undefined, { emotion: 'distress', confidence: 0.8 })
    );
    expect(result.intent).toBe('emergency');
    expect(result.triggerType).toBe('emotion');
  });

  test('Panic emotion with low confidence → general_triage (not enough signal)', async () => {
    const result = await router.classifyIntent(
      makeInput('kuch nahi', undefined, { emotion: 'panic', confidence: 0.5 })
    );
    expect(result.intent).toBe('general_triage');
  });

  test('Calm emotion → general_triage', async () => {
    const result = await router.classifyIntent(
      makeInput('bukhar hai', undefined, { emotion: 'calm', confidence: 0.95 })
    );
    expect(result.intent).toBe('general_triage');
  });
});

// ─── Default Routing to General Triage ───────────────────────────────────────

describe('Task 2.4: Unit tests — Default routing to general triage', () => {
  test('Common non-emergency symptoms → general_triage', async () => {
    const cases = [
      'bukhar hai teen din se',
      'sir mein dard hai',
      'khaasi aa rahi hai',
      'pet mein dard ho raha hai',
      'neend nahi aa rahi',
      'sugar ki problem hai',
    ];
    for (const text of cases) {
      const result = await router.classifyIntent(makeInput(text));
      expect(result.intent).toBe('general_triage');
    }
  });

  test('Negation sentences → general_triage (keyword scan skipped for >4 words)', async () => {
    const result = await router.classifyIntent(
      makeInput('mujhe seene mein dard nahi hai')
    );
    expect(result.intent).toBe('general_triage');
  });

  test('Past tense reference → general_triage', async () => {
    const result = await router.classifyIntent(
      makeInput('kal mere bhai ko chest pain tha')
    );
    expect(result.intent).toBe('general_triage');
  });
});

// ─── routeFromExtraction — drug routing (Req 2.10) ───────────────────────────

describe('routeFromExtraction: drug routing', () => {
  const makeExtraction = (overrides: object) => ({
    is_emergency: false,
    condition_id: 'drug_query' as const,
    patient_profile: { category: 'adult' as const, exact_age_mentioned: null, pregnancy_flag: 'not_applicable' as const },
    clinical_symptoms_english: [],
    drugs_mentioned: [],
    severity_signal: 'mild' as const,
    duration: null,
    location_mentioned: null,
    danger_signs_present: [],
    confidence: 0.9,
    language_register: 'pure_hindi' as const,
    ...overrides,
  });

  test('overdose → emergency regardless of is_emergency flag', () => {
    const result = router.routeFromExtraction(makeExtraction({
      drugs_mentioned: [{ name: 'paracetamol', query_type: 'overdose' }],
    }));
    expect(result.intent).toBe('emergency');
    expect(result.matchedKeywords).toContain('overdose');
  });

  test('drug safety query → drug intent', () => {
    const result = router.routeFromExtraction(makeExtraction({
      drugs_mentioned: [{ name: 'paracetamol', query_type: 'safety' }],
    }));
    expect(result.intent).toBe('drug');
  });

  test('drug dosage query → drug intent', () => {
    const result = router.routeFromExtraction(makeExtraction({
      drugs_mentioned: [{ name: 'metformin', query_type: 'dosage' }],
    }));
    expect(result.intent).toBe('drug');
  });

  test('drug availability query → drug intent', () => {
    const result = router.routeFromExtraction(makeExtraction({
      drugs_mentioned: [{ name: 'amoxicillin', query_type: 'availability' }],
    }));
    expect(result.intent).toBe('drug');
  });

  test('is_emergency=true + confidence >= 0.7 → emergency', () => {
    const result = router.routeFromExtraction(makeExtraction({
      is_emergency: true,
      confidence: 0.9,
    }));
    expect(result.intent).toBe('emergency');
  });

  test('is_emergency=false, no drugs → general_triage', () => {
    const result = router.routeFromExtraction(makeExtraction({}));
    expect(result.intent).toBe('general_triage');
  });
});
