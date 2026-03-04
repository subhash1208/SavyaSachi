import * as fc from 'fast-check';
import { DrugKBService } from '../../services/drugKB';
import { PatientProfile } from '../../models/types';
import { DrugQueryType } from '../../models/enums';
import { DRUG_DATABASE } from '../../data/drugDatabase';

const svc = new DrugKBService();

const adultProfile: PatientProfile = {
  category: 'adult',
  exact_age_mentioned: null,
  pregnancy_flag: 'not_applicable',
};

const pregnantProfile: PatientProfile = {
  category: 'adult',
  exact_age_mentioned: null,
  pregnancy_flag: 'confirmed',
};

const possiblyPregnantProfile: PatientProfile = {
  category: 'adult',
  exact_age_mentioned: null,
  pregnancy_flag: 'possible',
};

const pediatricProfile: PatientProfile = {
  category: 'pediatric',
  exact_age_mentioned: '5 years',
  pregnancy_flag: 'not_applicable',
};

// ─── Property 19: Drug pregnancy filter correctness ───────────────────────────

describe('Property 19: Drug pregnancy filter correctness', () => {
  const knownDrugs = DRUG_DATABASE.map(d => d.drug_name);

  test('confirmed pregnancy: dose_adult contains pregnancy note, not standard adult dose', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...knownDrugs),
        fc.constantFrom<DrugQueryType>('dosage', 'safety', 'availability'),
        async (drugName, queryType) => {
          const result = await svc.queryDrug(drugName, queryType, pregnantProfile);
          // Must not be not_found
          expect(result.not_found).toBeFalsy();
          // pregnancy_category must be present
          expect(result.pregnancy_category).toBeTruthy();
          expect(result.pregnancy_category).not.toBe('unknown');
          // dose_adult in pregnancy mode = pregnancy_note (not standard adult dose)
          if (result.dose_adult) {
            const entry = DRUG_DATABASE.find(d => d.drug_name === drugName)!;
            expect(result.dose_adult).toBe(entry.pregnancy_note);
          }
          // Req 14.2: SHALL NOT return adult male dosage information
          expect(result.max_daily_adult).toBeUndefined();
          expect(result.renal_adjustment).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('possible pregnancy: same filtering as confirmed pregnancy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...knownDrugs),
        async (drugName) => {
          const confirmed = await svc.queryDrug(drugName, 'dosage', pregnantProfile);
          const possible = await svc.queryDrug(drugName, 'dosage', possiblyPregnantProfile);
          expect(confirmed.dose_adult).toBe(possible.dose_adult);
          expect(confirmed.pregnancy_category).toBe(possible.pregnancy_category);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('pregnancy filter: result always has pregnancy_category field', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...knownDrugs),
        async (drugName) => {
          const result = await svc.queryDrug(drugName, 'safety', pregnantProfile);
          expect(result.pregnancy_category).toBeDefined();
          expect(typeof result.pregnancy_category).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 20: Drug not-found safe fallback ────────────────────────────────

describe('Property 20: Drug not-found safe fallback', () => {
  const unknownDrugArb = fc.string({ minLength: 3, maxLength: 20 }).filter(
    s => !DRUG_DATABASE.some(d =>
      d.drug_name === s.toLowerCase() ||
      d.aliases.some(a => a.toLowerCase() === s.toLowerCase())
    )
  );

  test('unknown drug: returns not_found=true, never throws, never returns null', async () => {
    await fc.assert(
      fc.asyncProperty(
        unknownDrugArb,
        fc.constantFrom<DrugQueryType>('dosage', 'safety', 'overdose', 'availability'),
        async (drugName, queryType) => {
          let result;
          expect(async () => {
            result = await svc.queryDrug(drugName, queryType, adultProfile);
          }).not.toThrow();
          result = await svc.queryDrug(drugName, queryType, adultProfile);
          expect(result).not.toBeNull();
          expect(result).not.toBeUndefined();
          expect(result.not_found).toBe(true);
          expect(result.drug_name).toBe(drugName);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('unknown drug: not_found result has required fields', async () => {
    const result = await svc.queryDrug('xyz_unknown_drug_123', 'dosage', adultProfile);
    expect(result.not_found).toBe(true);
    expect(result.drug_name).toBe('xyz_unknown_drug_123');
    expect(result.contraindications).toEqual([]);
    expect(result.pregnancy_category).toBe('unknown');
  });
});

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe('DrugKBService unit tests', () => {

  describe('queryDrug — known drugs', () => {
    test('paracetamol adult dosage', async () => {
      const result = await svc.queryDrug('paracetamol', 'dosage', adultProfile);
      expect(result.not_found).toBeFalsy();
      expect(result.drug_name).toBe('paracetamol');
      expect(result.dose_adult).toContain('500 mg');
      expect(result.max_daily_adult).toContain('4000 mg');
    });

    test('paracetamol alias lookup (crocin)', async () => {
      const result = await svc.queryDrug('crocin', 'dosage', adultProfile);
      expect(result.not_found).toBeFalsy();
      expect(result.drug_name).toBe('paracetamol');
    });

    test('paracetamol alias lookup (bukhar ki dawa)', async () => {
      const result = await svc.queryDrug('bukhar ki dawa', 'dosage', adultProfile);
      expect(result.not_found).toBeFalsy();
      expect(result.drug_name).toBe('paracetamol');
    });

    test('ORS — no overdose possible', async () => {
      const result = await svc.queryDrug('ors', 'overdose', adultProfile);
      expect(result.not_found).toBeFalsy();
      expect(result.overdose_threshold).toContain('cannot cause overdose');
    });

    test('metformin pediatric dosage', async () => {
      const result = await svc.queryDrug('metformin', 'dosage', pediatricProfile);
      expect(result.dose_child).toContain('Not recommended under 10 years');
      expect(result.dose_adult).toBeUndefined();
    });

    test('antivenom — pregnancy must be given regardless', async () => {
      const result = await svc.queryDrug('antivenom', 'safety', pregnantProfile);
      expect(result.not_found).toBeFalsy();
      expect(result.dose_adult).toContain('confirmed envenomation');
    });

    test('amlodipine pregnancy category C', async () => {
      const result = await svc.queryDrug('amlodipine', 'safety', pregnantProfile);
      expect(result.pregnancy_category).toBe('C');
    });

    test('amoxicillin pregnancy category B — safe', async () => {
      const result = await svc.queryDrug('amoxicillin', 'safety', pregnantProfile);
      expect(result.pregnancy_category).toBe('B');
    });
  });

  describe('checkOverdose', () => {
    test('known drug returns true (triggers emergency path)', () => {
      expect(svc.checkOverdose('paracetamol')).toBe(true);
      expect(svc.checkOverdose('metformin')).toBe(true);
      expect(svc.checkOverdose('amoxicillin')).toBe(true);
    });

    test('alias lookup works for checkOverdose', () => {
      expect(svc.checkOverdose('crocin')).toBe(true);
      expect(svc.checkOverdose('glucophage')).toBe(true);
    });

    test('unknown drug returns true (any overdose = emergency)', () => {
      expect(svc.checkOverdose('unknown_drug_xyz')).toBe(true);
    });
  });

  describe('pregnancy mode — Req 14.2 compliance', () => {
    test('pregnancy mode omits max_daily_adult (no adult male dosage leak)', async () => {
      const result = await svc.queryDrug('paracetamol', 'dosage', pregnantProfile);
      expect(result.dose_adult).toContain('Safe in all trimesters');  // pregnancy_note
      expect(result.max_daily_adult).toBeUndefined();  // must NOT leak adult max daily
      expect(result.renal_adjustment).toBeUndefined();  // must NOT leak adult renal adjustment
    });

    test('pregnancy mode omits adult fields for all drugs', async () => {
      for (const drug of DRUG_DATABASE) {
        const result = await svc.queryDrug(drug.drug_name, 'safety', pregnantProfile);
        expect(result.max_daily_adult).toBeUndefined();
        expect(result.renal_adjustment).toBeUndefined();
      }
    });

    test('non-pregnant adult still gets max_daily_adult and renal_adjustment', async () => {
      const result = await svc.queryDrug('paracetamol', 'dosage', adultProfile);
      expect(result.max_daily_adult).toContain('4000 mg');
      expect(result.renal_adjustment).toBeDefined();
    });
  });

  describe('overdose_threshold dedicated field', () => {
    test('overdose query populates overdose_threshold, preserves dose_adult', async () => {
      const result = await svc.queryDrug('metformin', 'overdose', adultProfile);
      expect(result.overdose_threshold).toContain('lactic acidosis');
      expect(result.dose_adult).toContain('500 mg');  // normal dose preserved
    });

    test('overdose query for pregnant patient uses adult threshold', async () => {
      const result = await svc.queryDrug('paracetamol', 'overdose', pregnantProfile);
      expect(result.overdose_threshold).toContain('liver failure');
      expect(result.dose_adult).toContain('Safe in all trimesters');  // pregnancy_note, not overwritten
    });
  });

  describe('non-standard patient categories', () => {
    test('geriatric category falls through to adult dosing', async () => {
      const geriatricProfile: PatientProfile = {
        category: 'geriatric',
        exact_age_mentioned: '72 years',
        pregnancy_flag: 'not_applicable',
      };
      const result = await svc.queryDrug('paracetamol', 'dosage', geriatricProfile);
      expect(result.dose_adult).toContain('500 mg');
      expect(result.max_daily_adult).toContain('4000 mg');
      expect(result.renal_adjustment).toBeDefined();
    });

    test('maternal category with no pregnancy flag gets adult dosing', async () => {
      const maternalProfile: PatientProfile = {
        category: 'maternal',
        exact_age_mentioned: null,
        pregnancy_flag: 'not_applicable',
      };
      const result = await svc.queryDrug('paracetamol', 'dosage', maternalProfile);
      expect(result.dose_adult).toContain('500 mg');
      expect(result.max_daily_adult).toContain('4000 mg');
    });

    test('unknown category falls through to adult dosing', async () => {
      const unknownProfile: PatientProfile = {
        category: 'unknown',
        exact_age_mentioned: null,
        pregnancy_flag: 'unknown',
      };
      const result = await svc.queryDrug('paracetamol', 'dosage', unknownProfile);
      expect(result.dose_adult).toContain('500 mg');
      expect(result.max_daily_adult).toContain('4000 mg');
    });
  });

  describe('all 7 NLEM drugs present', () => {
    const expectedDrugs = [
      'paracetamol', 'ors', 'metformin', 'amlodipine',
      'cotrimoxazole', 'amoxicillin', 'antivenom',
    ];

    test.each(expectedDrugs)('%s is in the database', async (drugName) => {
      const result = await svc.queryDrug(drugName, 'dosage', adultProfile);
      expect(result.not_found).toBeFalsy();
      expect(result.drug_name).toBe(drugName);
    });
  });

  describe('overdose query type', () => {
    test('paracetamol overdose returns threshold in dedicated field', async () => {
      const result = await svc.queryDrug('paracetamol', 'overdose', adultProfile);
      expect(result.overdose_threshold).toContain('liver failure');
      // dose_adult should still contain the normal adult dose, not the threshold
      expect(result.dose_adult).toContain('500 mg');
    });

    test('paracetamol overdose pediatric returns child threshold', async () => {
      const result = await svc.queryDrug('paracetamol', 'overdose', pediatricProfile);
      expect(result.overdose_threshold).toContain('150 mg/kg');
      // dose_adult should be undefined for pediatric (not overwritten with threshold)
      expect(result.dose_adult).toBeUndefined();
    });
  });
});
