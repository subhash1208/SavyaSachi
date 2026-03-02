import { ConversationState } from '../models/types';

export interface IConversationStateRepository {
  load(callSid: string): Promise<ConversationState | null>;
  save(state: ConversationState): Promise<void>;
  delete(callSid: string): Promise<void>;
}
