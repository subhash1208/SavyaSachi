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
 * Hindi pronouns and filler words that commonly precede city/location names
 * in natural speech. Stripped from regex captures to avoid polluting location data.
 * Example: "main Bhopal ke paas hoon" → nearCity should be "bhopal", not "main bhopal"
 */
const HINDI_FILLER_WORDS = new Set([
  'main', 'mein', 'hum', 'ham', 'mera', 'meri', 'mere', 'hamara', 'hamari', 'hamare',
  'yeh', 'ye', 'woh', 'wo', 'yahan', 'wahan', 'abhi', 'ab', 'aur', 'bhi',
  'ji', 'haan', 'nahi', 'na', 'toh', 'to', 'hi', 'bhai', 'sir', 'madam',
  'i', 'am', 'we', 'are', 'my', 'our', 'the', 'in', 'at', 'near', 'from',
]);

/**
 * 3-tier location detection:
 *   Tier 2 (automatic) — DynamoDB lookup from phone number prefix. Always runs silently.
 *     Landline: try STD code lengths 5→4→3→2 against vaidyavaani-std-codes
 *     Mobile:   first 4 digits against vaidyavaani-mobile-circles
 *     Fallback: static JSON in stdCodeDatabase.ts if DynamoDB unavailable
 *   Tier 1 (voice)     — Two sources, in priority order:
 *     1. Nova Lite `location_mentioned` from MasterExtractionResult (best quality, understands context)
 *     2. Regex parsing of raw utterance (fast, free, but can be wrong)
 *     The call handler (Task 16) should prefer Nova Lite when available.
 *   Tier 3 (GPS)       — SMS link; smartphones only, non-emergency.
 */
export class LocationDetectorService implements ILocationDetector {

  // ─── Tier 2: Phone prefix lookup ──────────────────────────────────────────

  async extractSTDCode(callerNumber: string): Promise<Tier2Location | null> {
    const normalized = callerNumber
      .replace(/^\+91/, '')
      .replace(/[\s\-]/g, '');

    // Fix #5: Some IVR systems prepend 0 to mobile numbers (e.g., 06000123456).
    // Strip leading 0 if the remaining digits form a valid mobile pattern.
    const forMobileCheck = normalized.startsWith('0') && /^0[6-9]\d{9}$/.test(normalized)
      ? normalized.substring(1)
      : normalized;

    const isMobile = /^[6-9]/.test(forMobileCheck) && forMobileCheck.length === 10;

    try {
      if (isMobile) {
        return await this._lookupMobile(forMobileCheck);
      } else {
        return await this._lookupLandline(normalized);
      }
    } catch (err) {
      Logger.warn('DynamoDB lookup failed, falling back to static DB', { error: (err as Error).message });
      return this._staticFallback(isMobile ? forMobileCheck : normalized);
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

  /**
   * Parse location from Nova Lite's `location_mentioned` field (MasterExtractionResult).
   * This is the PRIMARY Tier 1 source — Nova Lite understands natural language context
   * and handles complex Hindi descriptions that regex cannot parse.
   *
   * Call handler (Task 16) should call this FIRST with extraction.location_mentioned,
   * and only fall back to parseVoiceLocation(rawUtterance) if this returns null.
   */
  parseNovaLocation(locationMentioned: string | null): Tier1Location | null {
    if (!locationMentioned || locationMentioned.trim().length < 2) return null;

    const text = locationMentioned.trim();
    const timestamp = new Date().toISOString();

    // Nova Lite already extracted the meaningful location — trust it.
    // Try to classify accuracy based on content patterns.
    const lowerText = text.toLowerCase();

    // Village indicators
    if (/\b(gaon|village|gram|panchayat)\b/i.test(lowerText)) {
      const cleaned = this._stripFillerWords(lowerText.replace(/\b(gaon|village|gram|panchayat)\b/gi, '').trim());
      return { rawText: text, village: cleaned || text, accuracy: 'village', timestamp };
    }

    // Landmark indicators
    if (/\b(road|nagar|colony|chowk|station|mandir|masjid|hospital|school|bazaar|ke paas|nazdeek)\b/i.test(lowerText)) {
      return { rawText: text, landmark: text, accuracy: 'landmark', timestamp };
    }

    // Relative distance — "X se Y km"
    const distMatch = lowerText.match(/(.+?)\s+se\s+(\d+)\s*(?:km|kilometer)/i);
    if (distMatch) {
      return { rawText: text, nearCity: this._stripFillerWords(distMatch[1].trim()), accuracy: 'landmark', timestamp };
    }

    // Default: treat as city name (Nova Lite usually normalizes well)
    return { rawText: text, nearCity: this._stripFillerWords(text), accuracy: 'city', timestamp };
  }

  /**
   * Parse location from raw caller utterance using regex patterns.
   * This is the FALLBACK Tier 1 source — used when Nova Lite's location_mentioned
   * is null (e.g., caller provides location on a later turn after master extraction).
   *
   * Known limitation: regex can return wrong answers (e.g., capturing Hindi pronouns
   * as part of city names). Nova Lite should always be preferred when available.
   */
  parseVoiceLocation(utterance: string): Tier1Location | null {
    if (!utterance || utterance.trim().length < 3) return null;

    const text = utterance.toLowerCase().trim();
    const timestamp = new Date().toISOString();

    // Pattern 1: Relative distance — "X se Y km" or "X ke paas/nazdeek/samne"
    const relativeMatch = text.match(
      /(\w[\w\s]+?)\s+(?:se\s+(\d+)\s*(?:km|kilometer|kilo)|ke\s+(?:paas|nazdeek|samne|saamne))/i
    );
    if (relativeMatch) {
      const cleaned = this._stripFillerWords(relativeMatch[1].trim());
      return { rawText: utterance, nearCity: cleaned, accuracy: 'landmark', timestamp };
    }

    // Pattern 2: Village — "X gaon/village/gram"
    const villageMatch = text.match(
      /(\w[\w\s]+?)\s+(?:gaon|village|gram|grama|panchayat)/i
    );
    if (villageMatch) {
      const cleaned = this._stripFillerWords(villageMatch[1].trim());
      return { rawText: utterance, village: cleaned, accuracy: 'village', timestamp };
    }

    // Pattern 3: Landmark — road/nagar/colony/chowk/station/mandir etc.
    const landmarkMatch = text.match(
      /(\w[\w\s]+?)\s+(?:road|nagar|colony|mohalla|chowk|bazaar|bazar|mandir|masjid|school|hospital|station)/i
    );
    if (landmarkMatch) {
      const cleaned = this._stripFillerWords(landmarkMatch[1].trim());
      return { rawText: utterance, landmark: cleaned, accuracy: 'landmark', timestamp };
    }

    // Pattern 4: Short utterance — treat as city name
    if (text.split(' ').length <= 4) {
      const cleaned = this._stripFillerWords(utterance.trim());
      return { rawText: utterance, nearCity: cleaned, accuracy: 'city', timestamp };
    }

    return { rawText: utterance, accuracy: 'city', timestamp };
  }

  /**
   * Strip Hindi pronouns and filler words from a captured location string.
   * "main bhopal" → "bhopal", "hum indore" → "indore"
   */
  private _stripFillerWords(text: string): string {
    const words = text.split(/\s+/).filter(w => !HINDI_FILLER_WORDS.has(w.toLowerCase()));
    return words.length > 0 ? words.join(' ') : text; // if ALL words are filler, return original
  }

  // ─── Tier 3: GPS (smartphone only, non-emergency) ─────────────────────────

  async sendGPSLink(_callerNumber: string, _callId?: string): Promise<void> {
    // Production: send SMS via SNS with GPS capture link, callId used to correlate response
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
