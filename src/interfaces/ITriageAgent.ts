import { SymptomInput, KBResults, TriageAssessment, TreatmentAdvice } from '../models/types';
import { SeverityLevel, ICD10Code } from '../models/enums';

export interface ITriageAgent {
  assessSymptoms(input: SymptomInput, kbResults: KBResults, transcriptHistory?: string[]): Promise<TriageAssessment>;
  generateTreatmentAdvice(assessment: TriageAssessment): Promise<TreatmentAdvice>;
  tagICD10(conditionId: string): ICD10Code;
  determineFacilityLevel(severity: SeverityLevel): TriageAssessment['recommendedCareLevel'];
}
