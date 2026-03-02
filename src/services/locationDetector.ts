import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { ResolvedLocation, Tier1Location, Tier2Location } from '../models/types';
import { ILocationDetector } from '../interfaces/ILocationDetector';
import { lookupSTDCode } from '../data/stdCodeDatabase';
import { Logger } from '../utils/logger';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

const STD_TABLE    = 'vaidyavaani-std-codes';
const MOBILE_TABLE = 'vaidyavaani-mobile-circles';

/**
 * 3-tier location detection:
 *   Tier 2 (automatic) — DynamoDB lookup from phone number prefix. Always runs silently.
 *     Landline: try STD code lengths 5→4→3→2 against vaidyavaani-std-codes
 *     Mobile:   first 4 digits against vaidyavaani-mobile-circles
 *     Fallback: static JSON in stdCodeDatabase.ts if DynamoDB unavailable
 *   Tier 1 (voice)     — Parse spoken location from caller utterance.
 *   Tier 3 (GPS)       — SMS link; smartphones only, non-emergency.
 */
export class LocationDetectorService implements ILocationDetector {

  // ─── Tier 2: Phone prefix lookup ──────────────────────────────────────────

  async extractSTDCode(callerNumber: string): Promise<Tier2Location | null> {
    const normalized = callerNumber
      .replace(/^\+91/, '')
      .replace(/[\s\-]/g, '');

    const isMobile = /^[6-9]/.test(normalized) && normalized.length === 10;

    try {
      if (isMobile) {
        return await this._lookupMobile(normalized);
      } else {
        return await this._lookupLandline(normalized);
      }
    } catch (err) {
      Logger.warn('DynamoDB lookup failed, falling back to static DB', { error: (err as Error).message });
      return this._staticFallback(normalized);
    }
  }

  private async _lookupMobile(normalized: string): Promise<Tier2Location | null> {
    const prefix4 = normalized.substring(0, 4);
    const result = await dynamo.send(new GetItemCommand({
      TableName: MOBILE_TABLE,
      Key: { prefix4: { S: prefix4 } },
    }));

    if (!result.Item) {
      Logger.warn('Mobile prefix not found', { prefix4 });
      return null;
    }

    const item = unmarshall(result.Item) as { prefix4: string; state: string; circle: string; operator: string };
    return {
      stdCode: prefix4,
      city: item.circle,       // circle name as city approximation
      state: item.state,
      district: item.circle,   // circle as district approximation for mobile
      accuracy: 'district',
      method: 'automatic',
    };
  }

  private async _lookupLandline(normalized: string): Promise<Tier2Location | null> {
    // Ensure leading 0
    const withZero = normalized.startsWith('0') ? normalized : '0' + normalized;

    // Try longest match first: 5 → 4 → 3 → 2
    for (const len of [5, 4, 3, 2]) {
      const stdCode = withZero.substring(0, len);
      const result = await dynamo.send(new GetItemCommand({
        TableName: STD_TABLE,
        Key: { stdCode: { S: stdCode } },
      }));

      if (result.Item) {
        const item = unmarshall(result.Item) as { stdCode: string; city: string; state: string; district: string };
        return {
          stdCode: item.stdCode,
          city: item.city,
          state: item.state,
          district: item.district,
          accuracy: 'district',
          method: 'automatic',
        };
      }
    }

    Logger.warn('STD code not found in DynamoDB', {});
    return null;
  }

  private _staticFallback(normalized: string): Tier2Location | null {
    const withZero = normalized.startsWith('0') ? normalized : '0' + normalized;
    const entry = lookupSTDCode(withZero);
    if (!entry) return null;
    return {
      stdCode: entry.stdCode,
      city: entry.city,
      state: entry.state,
      district: entry.district,
      accuracy: 'district',
      method: 'automatic',
    };
  }

  // ─── Tier 1: Voice Location Parsing ───────────────────────────────────────

  parseVoiceLocation(utterance: string): Tier1Location | null {
    if (!utterance || utterance.trim().length < 3) return null;

    const text = utterance.toLowerCase().trim();
    const timestamp = new Date().toISOString();

    // Pattern 1: Relative distance — "X se Y km" or "X ke paas/nazdeek/samne"
    const relativeMatch = text.match(
      /(\w[\w\s]+?)\s+(?:se\s+(\d+)\s*(?:km|kilometer|kilo)|ke\s+(?:paas|nazdeek|samne|saamne))/i
    );
    if (relativeMatch) {
      return { rawText: utterance, nearCity: relativeMatch[1].trim(), accuracy: 'landmark', timestamp };
    }

    // Pattern 2: Village — "X gaon/village/gram"
    const villageMatch = text.match(
      /(\w[\w\s]+?)\s+(?:gaon|village|gram|grama|panchayat)/i
    );
    if (villageMatch) {
      return { rawText: utterance, village: villageMatch[1].trim(), accuracy: 'village', timestamp };
    }

    // Pattern 3: Landmark — road/nagar/colony/chowk/station/mandir etc.
    const landmarkMatch = text.match(
      /(\w[\w\s]+?)\s+(?:road|nagar|colony|mohalla|chowk|bazaar|bazar|mandir|masjid|school|hospital|station)/i
    );
    if (landmarkMatch) {
      return { rawText: utterance, landmark: landmarkMatch[1].trim(), accuracy: 'landmark', timestamp };
    }

    // Pattern 4: Short utterance — treat as city name
    if (text.split(' ').length <= 4) {
      return { rawText: utterance, nearCity: utterance.trim(), accuracy: 'city', timestamp };
    }

    return { rawText: utterance, accuracy: 'city', timestamp };
  }

  // ─── Tier 3: GPS (smartphone only, non-emergency) ─────────────────────────

  async sendGPSLink(_callerNumber: string): Promise<void> {
    // Production: send SMS via SNS with GPS capture link
    // Hackathon: no-op
    Logger.info('GPS link send requested (no-op in hackathon mode)');
  }

  async receiveGPSCoordinates(
    _callSid: string,
    latitude: number,
    longitude: number
  ): Promise<{ latitude: number; longitude: number }> {
    return { latitude, longitude };
  }

  // ─── Resolution: combine tiers into best available location ───────────────

  resolveLocation(tier2: Tier2Location, tier1?: Tier1Location): ResolvedLocation {
    const primaryLocation = tier1
      ? tier1.village ?? tier1.landmark ?? tier1.nearCity ?? tier2.city
      : tier2.city;

    const accuracyLevel = tier1 ? tier1.accuracy : 'district';

    Logger.info('Location resolved', { primaryLocation, accuracyLevel, hasTier1: !!tier1 });

    return {
      primaryLocation: `${primaryLocation}, ${tier2.district}, ${tier2.state}`,
      accuracyLevel,
      tier1,
      tier2,
    };
  }
}
