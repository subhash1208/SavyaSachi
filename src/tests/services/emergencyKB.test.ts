import { EmergencyKBService } from '../../services/emergencyKB';
import { EMERGENCY_SCRIPTS } from '../../data/emergencyScripts';
import { EmergencyCondition } from '../../models/enums';

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
});
