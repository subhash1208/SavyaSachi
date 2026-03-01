import { TriageResponse, TriageResult, ConversationContext } from '../models/types';
import { SeverityLevel } from '../models/enums';

export interface IGeneralTriageKB {
  queryTriage(symptoms: string[], patientCategory: string, context: ConversationContext): Promise<TriageResponse>;
  generateFollowUpQuestion(context: ConversationContext): Promise<string>;
  classifySeverity(triageResult: TriageResult): SeverityLevel;
}
