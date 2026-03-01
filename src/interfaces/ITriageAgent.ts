import { SymptomInput, KBResults, TriageAssessment, TreatmentAdvice } from '../models/types';
import { SeverityLevel, FacilityLevel, ICD10Code } from '../models/enums';

export interface ITriageAgent {
  assessSymptoms(input: SymptomInput, kbResults: KBResults): Promise<TriageAssessment>;
  generateTreatmentAdvice(assessment: TriageAssessment): Promise<TreatmentAdvice>;
  tagICD10(assessment: TriageAssessment): ICD10Code;
  determineFacilityLevel(severity: SeverityLevel): FacilityLevel;
}
