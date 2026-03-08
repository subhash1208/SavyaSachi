import { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { ConversationState } from '../models/types';
import { IConversationStateRepository } from '../interfaces/IConversationStateRepository';
import { Logger } from '../utils/logger';

const STATE_TABLE = 'vaidyavaani-conversation-state';
const TTL_1_HOUR = 60 * 60; // seconds

export class ConversationStateRepository implements IConversationStateRepository {

  constructor(private readonly _dynamo: DynamoDBClient = new DynamoDBClient({
    region: process.env.AWS_REGION ?? 'ap-south-1',
  })) {}

  /**
   * Loads ConversationState by callSid.
   * Returns null if not found (Turn 1 — new call).
   */
  async load(callSid: string): Promise<ConversationState | null> {
    try {
      const result = await this._dynamo.send(new GetItemCommand({
        TableName: STATE_TABLE,
        Key: { callSid: { S: callSid } },
      }));

      if (!result.Item) return null;

      return unmarshall(result.Item) as ConversationState;
    } catch (err) {
      Logger.error('Failed to load conversation state', { callSid, error: (err as Error).message });
      return null;
    }
  }

  /**
   * Saves ConversationState. Sets TTL = now + 1 hour (auto-cleanup for abandoned calls).
   */
  async save(state: ConversationState): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + TTL_1_HOUR;
    const item = { ...state, ttl };

    try {
      await this._dynamo.send(new PutItemCommand({
        TableName: STATE_TABLE,
        Item: marshall(item, { removeUndefinedValues: true }),
      }));
    } catch (err) {
      Logger.error('Failed to save conversation state', { callSid: state.callSid, error: (err as Error).message });
      // Non-fatal — call continues, but next turn won't have state (graceful degradation)
    }
  }

  /**
   * Deletes ConversationState after call ends.
   * Non-fatal — DynamoDB TTL will clean up if this fails.
   */
  async delete(callSid: string): Promise<void> {
    try {
      await this._dynamo.send(new DeleteItemCommand({
        TableName: STATE_TABLE,
        Key: { callSid: { S: callSid } },
      }));
    } catch (err) {
      Logger.warn('Failed to delete conversation state (TTL will clean up)', {
        callSid, error: (err as Error).message,
      });
    }
  }
}
