import { ClassificationInput, IntentResult, KeywordMatch, ConversationContext, MasterExtractionResult } from '../models/types';
import { Language } from '../models/enums';

export interface IIntentRouter {
  classifyIntent(input: ClassificationInput): Promise<IntentResult>;
  checkEmergencyKeywords(text: string, language: Language): KeywordMatch | null;
  checkDangerSigns(context: ConversationContext, currentUtterance?: string): boolean;
  routeFromExtraction(extraction: MasterExtractionResult): IntentResult;
  extractMasterTags(utterance: string, language: Language): Promise<MasterExtractionResult>;
}
