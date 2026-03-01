import { ClassificationInput, IntentResult, KeywordMatch, ConversationContext } from '../models/types';
import { Language } from '../models/enums';

export interface IIntentRouter {
  classifyIntent(input: ClassificationInput): Promise<IntentResult>;
  checkEmergencyKeywords(text: string, language: Language): KeywordMatch | null;
  checkDangerSigns(context: ConversationContext): boolean;
}
