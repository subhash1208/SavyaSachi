import { FHIRCondition, SeverityLevel } from '../models/types';

// SNOMED CT severity codes
const SEVERITY_SNOMED: Record<SeverityLevel, { code: string; display: string }> = {
  critical:   { code: '24484000', display: 'Severe' },
  urgent:     { code: '6736007',  display: 'Moderate' },
  'non-urgent': { code: '255604002', display: 'Mild' },
};

// ICD-10 display names for the conditions we handle
const ICD10_DISPLAY: Record<string, string> = {
  'I21.9': 'Acute myocardial infarction, unspecified',
  'I64':   'Stroke, not specified as haemorrhage or infarction',
  'T63.0': 'Toxic effect of snake venom',
  'R58':   'Haemorrhage, not elsewhere classified',
  'T17.9': 'Foreign body in respiratory tract, part unspecified',
  'T30.0': 'Burn of unspecified body region, unspecified degree',
  'T65.9': 'Toxic effect of unspecified substance',
  'T78.2': 'Anaphylactic shock, unspecified',
  'R56.9': 'Unspecified convulsions',
  'O14.9': 'Pre-eclampsia, unspecified',
  'O72.1': 'Other immediate postpartum haemorrhage',
  'T75.1': 'Drowning and nonfatal submersion',
  'J45.9': 'Asthma, unspecified',
  'R40.2': 'Unspecified coma',
  'P28.4': 'Other apnoea of newborn',
  'T67.0': 'Heatstroke and sunstroke',
  'A09':   'Other and unspecified gastroenteritis and colitis of infectious origin',
  'E86.0': 'Dehydration',
  'A90':   'Dengue fever',
  'E11.9': 'Type 2 diabetes mellitus without complications',
  'I10':   'Essential (primary) hypertension',
  'A15.0': 'Tuberculosis of lung',
  'R50.9': 'Fever, unspecified',
  'R51':   'Headache',
  'R69':   'Illness, unspecified',
  'Z34.9': 'Supervision of normal pregnancy, unspecified',
  'Z87.39': 'Other personal history of other diseases and conditions',
  'Z79.899': 'Other long term (current) drug therapy',
};

/**
 * Generates a FHIR R4 Condition resource from triage data.
 * Pure function — no AWS calls, no side effects.
 * Used by Call Logger before writing to DynamoDB (Req 8.7, 4.5).
 */
export function generateFHIRRecord(
  icd10Code: string,
  severity: SeverityLevel,
  recordedDate: string,
  patientRef?: string,
): FHIRCondition {
  const snomedSeverity = SEVERITY_SNOMED[severity] ?? SEVERITY_SNOMED['non-urgent'];
  const display = ICD10_DISPLAY[icd10Code] ?? `Condition code ${icd10Code}`;

  const record: FHIRCondition = {
    resourceType: 'Condition',
    code: {
      coding: [{
        system: 'http://hl7.org/fhir/sid/icd-10',
        code: icd10Code,
        display,
      }],
    },
    recordedDate,
    severity: {
      coding: [{
        system: 'http://snomed.info/sct',
        code: snomedSeverity.code,
        display: snomedSeverity.display,
      }],
    },
  };

  if (patientRef) {
    record.subject = { reference: patientRef };
  }

  return record;
}

/**
 * Round-trips a FHIR record through JSON serialization.
 * Used in property tests to verify no data loss.
 */
export function roundTripFHIR(record: FHIRCondition): FHIRCondition {
  return JSON.parse(JSON.stringify(record)) as FHIRCondition;
}
