import { DrugInfo } from '../models/types';
import { DrugQueryType } from '../models/enums';

/**
 * NLEM (National List of Essential Medicines) drug database — hackathon static fallback.
 * Production: DynamoDB table `vaidyavaani-drug-kb` (ingestion team handles data loading).
 * Sources: NLEM 2022, WHO EML 2023, CIMS India, NHM Drug Formulary.
 *
 * Pregnancy categories (FDA/CIMS):
 *   A = Controlled studies show no risk
 *   B = No evidence of risk in humans
 *   C = Risk cannot be ruled out
 *   D = Positive evidence of risk
 *   X = Contraindicated in pregnancy
 */

export interface DrugEntry {
  drug_name: string;
  aliases: string[];           // Hindi names, brand names, common misspellings
  dose_child: string;
  dose_adult: string;
  max_daily_adult: string;
  max_daily_child: string;
  contraindications: string[];
  pregnancy_category: string;
  pregnancy_note: string;
  renal_adjustment: string;
  overdose_threshold_adult: string;
  overdose_threshold_child: string;
  source: string;
}

export const DRUG_DATABASE: DrugEntry[] = [

  // ─── 1. PARACETAMOL ───────────────────────────────────────────────────────
  {
    drug_name: 'paracetamol',
    aliases: ['acetaminophen', 'crocin', 'dolo', 'calpol', 'paracetamol 500', 'bukhar ki dawa'],
    dose_child: '10–15 mg/kg every 4–6 hours. For 10 kg child: 100–150 mg per dose.',
    dose_adult: '500 mg to 1000 mg every 4–6 hours as needed.',
    max_daily_adult: '4000 mg (4 g) per day. Reduce to 2000 mg if liver disease or alcohol use.',
    max_daily_child: '60 mg/kg/day. Do not exceed 5 doses in 24 hours.',
    contraindications: ['severe liver disease', 'active hepatitis', 'known hypersensitivity to paracetamol'],
    pregnancy_category: 'B',
    pregnancy_note: 'Safe in all trimesters at recommended doses. Preferred analgesic/antipyretic in pregnancy.',
    renal_adjustment: 'Reduce frequency to every 8 hours if severe renal impairment (eGFR < 10 mL/min).',
    overdose_threshold_adult: 'More than 7.5 g (15 tablets of 500 mg) in 24 hours — risk of liver failure.',
    overdose_threshold_child: 'More than 150 mg/kg in 24 hours — immediate hospital required.',
    source: 'NLEM 2022, WHO EML 2023, NHM India Drug Formulary',
  },

  // ─── 2. ORS (ORAL REHYDRATION SALTS) ─────────────────────────────────────
  {
    drug_name: 'ors',
    aliases: ['oral rehydration salts', 'electral', 'pedialyte', 'jeevan jal', 'ors powder', 'dehydration salt'],
    dose_child: 'Under 2 years: 50–100 mL after each loose stool. 2–10 years: 100–200 mL after each loose stool.',
    dose_adult: '200–400 mL after each loose stool. Drink as much as tolerated.',
    max_daily_adult: 'No upper limit — drink as needed to replace fluid losses.',
    max_daily_child: 'No upper limit — give as much as child will take.',
    contraindications: ['severe vomiting preventing oral intake (IV fluids needed)', 'intestinal obstruction'],
    pregnancy_category: 'A',
    pregnancy_note: 'Completely safe in pregnancy. Recommended for dehydration in all trimesters.',
    renal_adjustment: 'Use with caution in severe renal failure — monitor electrolytes.',
    overdose_threshold_adult: 'Not applicable — ORS cannot cause overdose at normal use.',
    overdose_threshold_child: 'Not applicable — ORS cannot cause overdose at normal use.',
    source: 'WHO ORS Guidelines 2006, NLEM 2022, IMCI Protocol',
  },

  // ─── 3. METFORMIN ─────────────────────────────────────────────────────────
  {
    drug_name: 'metformin',
    aliases: ['glucophage', 'glycomet', 'metformin 500', 'sugar ki dawa', 'diabetes tablet'],
    dose_child: 'Not recommended under 10 years. 10+ years: 500 mg twice daily with meals, max 2000 mg/day.',
    dose_adult: '500 mg twice daily with meals. Increase by 500 mg weekly. Usual dose: 1000–2000 mg/day.',
    max_daily_adult: '2550 mg per day (3 divided doses).',
    max_daily_child: '2000 mg per day for children 10+ years.',
    contraindications: [
      'eGFR < 30 mL/min (severe renal impairment)',
      'active liver disease',
      'heart failure requiring medication',
      'contrast dye procedure within 48 hours',
      'excessive alcohol use',
    ],
    pregnancy_category: 'B',
    pregnancy_note: 'Generally safe in pregnancy for gestational diabetes. Consult doctor — insulin may be preferred.',
    renal_adjustment: 'Reduce dose if eGFR 30–45. Stop if eGFR < 30. Risk of lactic acidosis.',
    overdose_threshold_adult: 'More than 5000 mg — risk of lactic acidosis. Seek emergency care.',
    overdose_threshold_child: 'Any dose above prescribed — seek medical advice immediately.',
    source: 'NLEM 2022, ADA Standards of Care 2024, CIMS India',
  },

  // ─── 4. AMLODIPINE ────────────────────────────────────────────────────────
  {
    drug_name: 'amlodipine',
    aliases: ['norvasc', 'amlong', 'amlodipine 5mg', 'bp ki dawa', 'blood pressure tablet', 'calcium channel blocker'],
    dose_child: '0.1–0.2 mg/kg/day once daily. Max 5 mg/day for children under 6 years.',
    dose_adult: '5 mg once daily. May increase to 10 mg once daily after 7–14 days.',
    max_daily_adult: '10 mg per day.',
    max_daily_child: '5 mg per day.',
    contraindications: [
      'severe hypotension (BP < 90/60)',
      'cardiogenic shock',
      'known hypersensitivity to amlodipine or dihydropyridines',
    ],
    pregnancy_category: 'C',
    pregnancy_note: 'Use only if benefit outweighs risk. Nifedipine preferred for hypertension in pregnancy. Consult doctor.',
    renal_adjustment: 'No dose adjustment needed for renal impairment.',
    overdose_threshold_adult: 'More than 30 mg — risk of severe hypotension and heart block. Emergency care needed.',
    overdose_threshold_child: 'Any dose above prescribed — seek emergency care immediately.',
    source: 'NLEM 2022, JNC 8 Hypertension Guidelines, CIMS India',
  },

  // ─── 5. COTRIMOXAZOLE ─────────────────────────────────────────────────────
  {
    drug_name: 'cotrimoxazole',
    aliases: ['trimethoprim-sulfamethoxazole', 'bactrim', 'septran', 'co-trimoxazole', 'cotrim', 'infection tablet'],
    dose_child: '4 mg/kg trimethoprim component twice daily. Standard tablet (80/400 mg): half tablet twice daily for 10–20 kg.',
    dose_adult: '960 mg (one double-strength tablet) twice daily for 5–7 days.',
    max_daily_adult: '1920 mg per day (2 double-strength tablets).',
    max_daily_child: '8 mg/kg/day trimethoprim component.',
    contraindications: [
      'sulfonamide allergy',
      'severe renal impairment (eGFR < 15)',
      'severe liver disease',
      'megaloblastic anaemia due to folate deficiency',
      'infants under 6 weeks',
    ],
    pregnancy_category: 'C',
    pregnancy_note: 'Avoid in first trimester (folate antagonism) and near term (neonatal jaundice risk). Use only if no alternative.',
    renal_adjustment: 'Reduce dose by 50% if eGFR 15–30. Avoid if eGFR < 15.',
    overdose_threshold_adult: 'More than 4800 mg — risk of crystalluria and renal damage. Seek care.',
    overdose_threshold_child: 'Any dose above prescribed — seek medical advice.',
    source: 'NLEM 2022, WHO EML 2023, NHM India',
  },

  // ─── 6. AMOXICILLIN ───────────────────────────────────────────────────────
  {
    drug_name: 'amoxicillin',
    aliases: ['amoxil', 'mox', 'novamox', 'amoxicillin 500', 'antibiotic', 'penicillin tablet'],
    dose_child: '25–50 mg/kg/day in 3 divided doses. For 10 kg child: 250 mg three times daily.',
    dose_adult: '250–500 mg three times daily for 5–7 days. Severe infections: 875 mg twice daily.',
    max_daily_adult: '3000 mg per day (standard). Up to 6000 mg for severe infections under medical supervision.',
    max_daily_child: '90 mg/kg/day for severe infections (e.g., pneumonia).',
    contraindications: [
      'penicillin allergy',
      'cephalosporin allergy (cross-reactivity possible)',
      'infectious mononucleosis (causes rash)',
    ],
    pregnancy_category: 'B',
    pregnancy_note: 'Safe in all trimesters. Preferred antibiotic for common infections in pregnancy.',
    renal_adjustment: 'Reduce dose frequency if eGFR < 30. Avoid high doses if eGFR < 10.',
    overdose_threshold_adult: 'More than 6000 mg — risk of seizures and renal crystallization.',
    overdose_threshold_child: 'More than 250 mg/kg — seek emergency care.',
    source: 'NLEM 2022, WHO EML 2023, IAP Drug Formulary',
  },

  // ─── 7. ANTIVENOM (POLYVALENT SNAKE ANTIVENOM) ────────────────────────────
  {
    drug_name: 'antivenom',
    aliases: ['snake antivenom', 'polyvalent antivenom', 'anti-snake venom', 'asv', 'saanp ka ilaaj', 'venom antidote'],
    dose_child: 'Same as adult — dose is based on venom load, not patient weight. 10 vials IV initially.',
    dose_adult: '10 vials (100 mL) IV over 30–60 minutes. Repeat if no improvement after 1–2 hours.',
    max_daily_adult: 'No fixed maximum — titrate to clinical response. Up to 30+ vials in severe envenomation.',
    max_daily_child: 'Same as adult — no weight-based adjustment.',
    contraindications: [
      'known hypersensitivity to horse serum (relative — premedicate with adrenaline)',
      'antivenom should NEVER be withheld in confirmed envenomation due to allergy risk alone',
    ],
    pregnancy_category: 'C',
    pregnancy_note: 'Must be given in confirmed envenomation regardless of pregnancy — risk of death from venom far exceeds antivenom risk.',
    renal_adjustment: 'No adjustment needed — antivenom is a biological product.',
    overdose_threshold_adult: 'Not applicable — antivenom is titrated to clinical response.',
    overdose_threshold_child: 'Not applicable — antivenom is titrated to clinical response.',
    source: 'WHO Snakebite Guidelines 2019, India NAPSE 2024, NLEM 2022',
  },
];

/** Lookup by drug name or alias (case-insensitive) */
export function findDrugEntry(drugName: string): DrugEntry | null {
  const normalized = drugName.toLowerCase().trim();
  return DRUG_DATABASE.find(d =>
    d.drug_name === normalized ||
    d.aliases.some(a => a.toLowerCase() === normalized)
  ) ?? null;
}
