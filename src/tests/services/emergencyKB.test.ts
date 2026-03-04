import { EmergencyKBService } from '../../services/emergencyKB';
import { EMERGENCY_SCRIPTS } from '../../data/emergencyScripts';
import { EmergencyCondition } from '../../models/enums';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const ddbMock = mockClient(DynamoDBClient);

// Reset mock before all tests so static-fallback tests aren't affected
beforeEach(() => {
  ddbMock.reset();
});

const kb = new EmergencyKBService();
const ABCDE_ORDER: Array<keyof typeof EMERGENCY_SCRIPTS[0]['abcdeAssessment']> =
  ['airway', 'breathing', 'circulation', 'disability', 'exposure'];

// ─── Property 3: Emergency script structure completeness ─────────────────────

describe('Property 3: Emergency script structure completeness', () => {

  test('All 4 demo-critical conditions have scripts', async () => {
    const demoCritical: EmergencyCondition[] = ['cardiac', 'snakebite', 'child_fever', 'breathing_difficulty'];
    for (const condition of demoCritical) {
      const script = await kb.retrieveEmergencyScript(condition, 'adult');
      expect(script).toBeDefined();
      expect(script.condition).toBe(condition);
    }
  });

  test('Every script has all 5 ABCDE steps in correct order', async () => {
    for (const script of EMERGENCY_SCRIPTS) {
      const steps = Object.keys(script.abcdeAssessment);
      expect(steps).toEqual(ABCDE_ORDER);
    }
  });

  test('Every ABCDE step has bilingual questions and bilingual actions', () => {
    for (const script of EMERGENCY_SCRIPTS) {
      for (const stepName of ABCDE_ORDER) {
        const step = script.abcdeAssessment[stepName];
        // Questions
        expect(step.questionHindi).toBeTruthy();
        expect(step.questionEnglish).toBeTruthy();
        // Actions — bilingual
        expect(step.yesAction.hindi).toBeTruthy();
        expect(step.yesAction.english).toBeTruthy();
        expect(step.noAction.hindi).toBeTruthy();
        expect(step.noAction.english).toBeTruthy();
      }
    }
  });

  test('Every script has non-empty bilingual immediateActions', () => {
    for (const script of EMERGENCY_SCRIPTS) {
      expect(script.immediateActions.length).toBeGreaterThan(0);
      for (const action of script.immediateActions) {
        expect(action.hindi).toBeTruthy();
        expect(action.english).toBeTruthy();
      }
    }
  });

  test('Every script has non-empty bilingual doNotActions', () => {
    for (const script of EMERGENCY_SCRIPTS) {
      expect(script.doNotActions.length).toBeGreaterThan(0);
      for (const action of script.doNotActions) {
        expect(action.hindi).toBeTruthy();
        expect(action.english).toBeTruthy();
      }
    }
  });

  test('Every script has a valid ICD-10 code (letter + digits format)', () => {
    const icd10Pattern = /^[A-Z]\d{2}(\.\d+)?$/;
    for (const script of EMERGENCY_SCRIPTS) {
      expect(script.icd10Code).toMatch(icd10Pattern);
    }
  });

  test('Every script has dispatch type of 108 or 102', () => {
    for (const script of EMERGENCY_SCRIPTS) {
      expect(['108', '102']).toContain(script.dispatchType);
    }
  });

  test('Every script severity is CRITICAL', () => {
    for (const script of EMERGENCY_SCRIPTS) {
      expect(script.severity).toBe('CRITICAL');
    }
  });
});

// ─── Task 3.3: Unit tests for specific scripts ────────────────────────────────

describe('Task 3.3: Unit tests — specific script content', () => {

  test('Cardiac script has correct ICD-10 (I21.9) and dispatch (108)', async () => {
    const script = await kb.retrieveEmergencyScript('cardiac', 'adult');
    expect(script.icd10Code).toBe('I21.9');
    expect(script.dispatchType).toBe('108');
  });

  test('Snakebite script includes myth-busting doNotActions (no tourniquet)', async () => {
    const script = await kb.retrieveEmergencyScript('snakebite', 'adult');
    const doNotHindi = script.doNotActions.map(a => a.hindi.toLowerCase()).join(' ');
    const doNotEnglish = script.doNotActions.map(a => a.english.toLowerCase()).join(' ');
    expect(doNotHindi).toContain('tourniquet');
    expect(doNotEnglish).toContain('tourniquet');
  });

  test('Snakebite script has correct ICD-10 (T63.0)', async () => {
    const script = await kb.retrieveEmergencyScript('snakebite', 'adult');
    expect(script.icd10Code).toBe('T63.0');
  });

  test('Child fever script warns against aspirin for children', async () => {
    const script = await kb.retrieveEmergencyScript('child_fever', 'pediatric');
    const doNotEnglish = script.doNotActions.map(a => a.english.toLowerCase()).join(' ');
    expect(doNotEnglish).toContain('aspirin');
  });

  test('Breathing difficulty script instructs to sit upright (never lay down)', async () => {
    const script = await kb.retrieveEmergencyScript('breathing_difficulty', 'adult');
    const actionsEnglish = script.immediateActions.map(a => a.english.toLowerCase()).join(' ');
    expect(actionsEnglish).toContain('upright');
  });

  test('ABCDE steps are in correct order for cardiac', async () => {
    const script = await kb.retrieveEmergencyScript('cardiac', 'adult');
    const steps = Object.keys(script.abcdeAssessment);
    expect(steps[0]).toBe('airway');
    expect(steps[1]).toBe('breathing');
    expect(steps[2]).toBe('circulation');
    expect(steps[3]).toBe('disability');
    expect(steps[4]).toBe('exposure');
  });

  test('Unknown condition throws error', async () => {
    await expect(
      kb.retrieveEmergencyScript('unknown_condition' as EmergencyCondition, 'adult')
    ).rejects.toThrow();
  });

  test('Patient category fallback — geriatric falls back to adult script', async () => {
    // Static fallback doesn't differentiate by category — returns first match
    // This mirrors the DynamoDB fallback behavior (tries adult if exact category not found)
    const script = await kb.retrieveEmergencyScript('cardiac', 'geriatric');
    expect(script).toBeDefined();
    expect(script.condition).toBe('cardiac');
  });

  test('Child fever script accessible with "pediatric" category', async () => {
    const script = await kb.retrieveEmergencyScript('child_fever', 'pediatric');
    expect(script).toBeDefined();
    expect(script.condition).toBe('child_fever');
    expect(script.icd10Code).toBe('A09');
  });

  test('All 16 conditions have scripts in static array', () => {
    const conditions: EmergencyCondition[] = [
      'cardiac', 'stroke', 'snakebite', 'severe_bleeding', 'choking',
      'burns', 'poisoning', 'anaphylaxis', 'seizure', 'pregnancy_emergency',
      'drowning', 'breathing_difficulty', 'unconsciousness',
      'infant_not_breathing', 'heatstroke', 'child_fever',
    ];
    for (const condition of conditions) {
      const found = EMERGENCY_SCRIPTS.find(s => s.condition === condition);
      expect(found).toBeDefined();
    }
  });

  test('Dispatch instructions have bilingual messages for all 4 demo scripts', async () => {
    const demoConditions: EmergencyCondition[] = ['cardiac', 'snakebite', 'child_fever', 'breathing_difficulty'];
    for (const condition of demoConditions) {
      const script = await kb.retrieveEmergencyScript(condition, 'adult');
      expect(script.dispatchInstructions.messageHindi).toBeTruthy();
      expect(script.dispatchInstructions.messageEnglish).toBeTruthy();
      expect(script.dispatchInstructions.dispatchNumber).toBe('108');
    }
  });

  test('getABCDEAssessment returns correct ABCDE structure for cardiac', async () => {
    const abcde = await kb.getABCDEAssessment('cardiac', 'adult');
    const steps = Object.keys(abcde);
    expect(steps).toEqual(['airway', 'breathing', 'circulation', 'disability', 'exposure']);
    // Verify it's the cardiac-specific content, not a generic stub
    expect(abcde.airway.questionEnglish).toContain('conscious');
    expect(abcde.circulation.questionEnglish).toContain('compressions');
  });

  test('getABCDEAssessment returns child-specific content for child_fever', async () => {
    const abcde = await kb.getABCDEAssessment('child_fever', 'pediatric');
    expect(abcde.airway.questionEnglish).toContain('child');
    expect(abcde.disability.questionEnglish).toContain('convulsions');
  });
});

// ─── DynamoDB path tests (mocked) ────────────────────────────────────────────

describe('DynamoDB path — mocked', () => {

  // Build a minimal DynamoDB item that mirrors what the seed script stores
  const makeDynamoItem = (conditionId: string, patientCategory: string) => marshall({
    condition_id: conditionId,
    patient_category: patientCategory,
    icd10Code: 'I21.9',
    dispatchType: '108',
    severity: 'CRITICAL',
    source: 'test-source',
    abcdeAssessment: {
      airway: { questionHindi: 'Q-H', questionEnglish: 'Q-E', yesAction: { hindi: 'Y-H', english: 'Y-E' }, noAction: { hindi: 'N-H', english: 'N-E' }, escalationTrigger: true },
      breathing: { questionHindi: 'Q-H', questionEnglish: 'Q-E', yesAction: { hindi: 'Y-H', english: 'Y-E' }, noAction: { hindi: 'N-H', english: 'N-E' } },
      circulation: { questionHindi: 'Q-H', questionEnglish: 'Q-E', yesAction: { hindi: 'Y-H', english: 'Y-E' }, noAction: { hindi: 'N-H', english: 'N-E' } },
      disability: { questionHindi: 'Q-H', questionEnglish: 'Q-E', yesAction: { hindi: 'Y-H', english: 'Y-E' }, noAction: { hindi: 'N-H', english: 'N-E' } },
      exposure: { questionHindi: 'Q-H', questionEnglish: 'Q-E', yesAction: { hindi: 'Y-H', english: 'Y-E' }, noAction: { hindi: 'N-H', english: 'N-E' } },
    },
    immediateActions: [{ hindi: 'IA-H', english: 'IA-E' }],
    doNotActions: [{ hindi: 'DN-H', english: 'DN-E' }],
    dispatchInstructions: { dispatchType: '108', dispatchNumber: '108', messageHindi: 'DI-H', messageEnglish: 'DI-E' },
  }, { removeUndefinedValues: true });

  afterEach(() => {
    ddbMock.resetHistory();
  });

  test('DynamoDB exact match — condition_id mapped to condition field', async () => {
    ddbMock.on(GetItemCommand).resolves({ Item: makeDynamoItem('cardiac', 'adult') });

    const script = await kb.retrieveEmergencyScript('cardiac', 'adult');
    // The critical assertion: condition field must be populated from condition_id
    expect(script.condition).toBe('cardiac');
    expect(script.icd10Code).toBe('I21.9');
    expect(script.severity).toBe('CRITICAL');
  });

  test('DynamoDB exact match — ABCDE structure intact after unmarshall', async () => {
    ddbMock.on(GetItemCommand).resolves({ Item: makeDynamoItem('snakebite', 'adult') });

    const script = await kb.retrieveEmergencyScript('snakebite', 'adult');
    const steps = Object.keys(script.abcdeAssessment);
    expect(steps).toEqual(['airway', 'breathing', 'circulation', 'disability', 'exposure']);
    expect(script.abcdeAssessment.airway.escalationTrigger).toBe(true);
  });

  test('DynamoDB category miss → adult fallback query', async () => {
    // First call (geriatric) returns no item, second call (adult) returns item
    ddbMock.on(GetItemCommand)
      .resolvesOnce({ Item: undefined })
      .resolvesOnce({ Item: makeDynamoItem('cardiac', 'adult') });

    const script = await kb.retrieveEmergencyScript('cardiac', 'geriatric');
    expect(script.condition).toBe('cardiac');
    expect(script.icd10Code).toBe('I21.9');
  });

  test('DynamoDB category miss + adult miss → static fallback', async () => {
    // Both DynamoDB calls return no item
    ddbMock.on(GetItemCommand).resolves({ Item: undefined });

    const script = await kb.retrieveEmergencyScript('cardiac', 'geriatric');
    expect(script.condition).toBe('cardiac');
    // Verify it came from static (static has full content, mock has minimal)
    expect(script.immediateActions.length).toBeGreaterThan(1);
  });

  test('DynamoDB error → static fallback (resilience)', async () => {
    ddbMock.on(GetItemCommand).rejects(new Error('DynamoDB timeout'));

    const script = await kb.retrieveEmergencyScript('cardiac', 'adult');
    expect(script.condition).toBe('cardiac');
    expect(script.icd10Code).toBe('I21.9');
    // Verify it came from static (has 5 immediateActions vs mock's 1)
    expect(script.immediateActions.length).toBe(5);
  });

  test('DynamoDB adult category skips fallback query (no double fetch)', async () => {
    // When patientCategory is already 'adult', the service should NOT make a second query
    ddbMock.on(GetItemCommand).resolves({ Item: undefined });

    const script = await kb.retrieveEmergencyScript('cardiac', 'adult');
    // Should fall through to static — only 1 DynamoDB call made (not 2)
    expect(script.condition).toBe('cardiac');
    // Verify only 1 call was made (adult doesn't retry adult)
    const calls = ddbMock.commandCalls(GetItemCommand);
    expect(calls.length).toBe(1);
  });

  test('getABCDEAssessment via DynamoDB path', async () => {
    ddbMock.on(GetItemCommand).resolves({ Item: makeDynamoItem('cardiac', 'adult') });

    const abcde = await kb.getABCDEAssessment('cardiac', 'adult');
    expect(abcde.airway.questionHindi).toBe('Q-H');
    expect(abcde.airway.escalationTrigger).toBe(true);
  });
});
