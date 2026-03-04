import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { EmergencyScript, ABCDEScript } from '../models/types';
import { EmergencyCondition } from '../models/enums';
import { IEmergencyKB } from '../interfaces/IEmergencyKB';
import { EMERGENCY_SCRIPTS } from '../data/emergencyScripts';
import { Logger } from '../utils/logger';

const TABLE = 'vaidyavaani-emergency-scripts';
const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

export class EmergencyKBService implements IEmergencyKB {

  async retrieveEmergencyScript(
    condition: EmergencyCondition,
    patientCategory: string
  ): Promise<EmergencyScript> {

    // Try DynamoDB first — exact category match
    try {
      const result = await client.send(new GetItemCommand({
        TableName: TABLE,
        Key: {
          condition_id:    { S: condition },
          patient_category: { S: patientCategory },
        },
      }));

      if (result.Item) {
        Logger.info('Emergency script fetched from DynamoDB', { condition, patientCategory });
        const raw = unmarshall(result.Item) as Record<string, unknown>;
        // DynamoDB PK is condition_id — map to TypeScript field name 'condition'
        raw.condition = raw.condition_id;
        return raw as unknown as EmergencyScript;
      }

      // Category not found — fall back to "adult" variant
      if (patientCategory !== 'adult') {
        const fallback = await client.send(new GetItemCommand({
          TableName: TABLE,
          Key: {
            condition_id:    { S: condition },
            patient_category: { S: 'adult' },
          },
        }));

        if (fallback.Item) {
          Logger.info('Emergency script fetched from DynamoDB (adult fallback)', { condition, patientCategory });
          const raw = unmarshall(fallback.Item) as Record<string, unknown>;
          raw.condition = raw.condition_id;
          return raw as unknown as EmergencyScript;
        }
      }
    } catch (err) {
      // DynamoDB unavailable — fall through to static fallback
      Logger.error('DynamoDB unavailable, using static fallback', {
        condition,
        error: (err as Error).message,
      });
    }

    // Static fallback — same data, always available
    const script = EMERGENCY_SCRIPTS.find(s => s.condition === condition);
    if (!script) {
      Logger.error('Emergency script not found', { condition, patientCategory });
      throw new Error(`No emergency script found for condition: ${condition}`);
    }

    Logger.info('Emergency script fetched from static fallback', { condition, patientCategory });
    return script;
  }

  async getABCDEAssessment(
    condition: EmergencyCondition,
    patientCategory: string
  ): Promise<ABCDEScript> {
    const script = await this.retrieveEmergencyScript(condition, patientCategory);
    return script.abcdeAssessment;
  }
}
