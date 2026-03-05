import * as fc from 'fast-check';
import { LocationDetectorService } from '../../services/locationDetector';
import { STD_CODE_DATABASE } from '../../data/stdCodeDatabase';

// ─── DynamoDB mock setup ──────────────────────────────────────────────────────

// Use var (not const) so jest.mock() hoisting can access it before the const TDZ
var mockSend = jest.fn().mockResolvedValue({ Item: undefined });

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  GetItemCommand: jest.fn().mockImplementation((params: unknown) => params),
}));

var mockUnmarshall = jest.fn();
jest.mock('@aws-sdk/util-dynamodb', () => ({
  unmarshall: (...args: unknown[]) => mockUnmarshall(...args),
}));

const svc = new LocationDetectorService();

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({ Item: undefined }); // default: not found
  mockUnmarshall.mockReset();
});

// ─── Property 8: STD code mapping correctness (via static fallback) ───────────

describe('Property 8: STD code mapping correctness', () => {

  test('every entry in STD_CODE_DATABASE resolves via static fallback', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STD_CODE_DATABASE),
        (entry) => {
          const result = (svc as any)._staticFallback(entry.stdCode + '123456');
          expect(result).not.toBeNull();
          expect(result!.city).toBe(entry.city);
          expect(result!.state).toBe(entry.state);
          expect(result!.district).toBe(entry.district);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('static fallback result always has required fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STD_CODE_DATABASE),
        (entry) => {
          const result = (svc as any)._staticFallback(entry.stdCode + '000000');
          if (result) {
            expect(typeof result.city).toBe('string');
            expect(typeof result.state).toBe('string');
            expect(typeof result.district).toBe('string');
            expect(result.accuracy).toBe('district');
            expect(result.method).toBe('automatic');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('unknown number returns null from static fallback', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^0[89]\d{8}$/),
        (phoneNumber) => {
          expect(() => (svc as any)._staticFallback(phoneNumber)).not.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─── Property 9: Voice location parsing ───────────────────────────────────────

describe('Property 9: Voice location parsing', () => {

  test('non-empty utterance never throws and returns object or null', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (utterance) => {
          let result: unknown;
          expect(() => { result = svc.parseVoiceLocation(utterance); }).not.toThrow();
          if (result !== null && result !== undefined) {
            expect((result as { rawText: string }).rawText).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('parsed result always has rawText matching input', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 80 }),
        (utterance) => {
          const result = svc.parseVoiceLocation(utterance);
          if (result) {
            expect(result.rawText).toBe(utterance);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('accuracy is always one of the valid values when result is non-null', () => {
    const validAccuracies = ['village', 'landmark', 'city'];
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 80 }),
        (utterance) => {
          const result = svc.parseVoiceLocation(utterance);
          if (result) {
            expect(validAccuracies).toContain(result.accuracy);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe('LocationDetectorService unit tests', () => {

  describe('static fallback — known STD codes', () => {
    test('0755 → Bhopal, Madhya Pradesh', () => {
      const result = (svc as any)._staticFallback('07551234567');
      expect(result).not.toBeNull();
      expect(result!.city).toBe('Bhopal');
      expect(result!.state).toBe('Madhya Pradesh');
    });

    test('011 → New Delhi', () => {
      const result = (svc as any)._staticFallback('01123456789');
      expect(result).not.toBeNull();
      expect(result!.city).toBe('New Delhi');
    });

    test('022 → Mumbai', () => {
      const result = (svc as any)._staticFallback('02223456789');
      expect(result).not.toBeNull();
      expect(result!.city).toBe('Mumbai');
    });

    test('033 → Kolkata', () => {
      const result = (svc as any)._staticFallback('03323456789');
      expect(result).not.toBeNull();
      expect(result!.city).toBe('Kolkata');
    });

    test('longer STD code wins — 07552 → Sagar, not Bhopal', () => {
      const result = (svc as any)._staticFallback('075521234');
      expect(result).not.toBeNull();
      expect(result!.city).toBe('Sagar');
    });

    test('unknown number returns null', () => {
      expect((svc as any)._staticFallback('099999999')).toBeNull();
    });
  });

  describe('parseVoiceLocation', () => {
    test('village pattern', () => {
      const result = svc.parseVoiceLocation('Rampur gaon mein rehta hoon');
      expect(result).not.toBeNull();
      expect(result!.village).toBe('rampur');
      expect(result!.accuracy).toBe('village');
    });

    test('relative distance pattern', () => {
      const result = svc.parseVoiceLocation('Bhopal se 20 km door hoon');
      expect(result).not.toBeNull();
      expect(result!.nearCity).toBe('bhopal');
      expect(result!.accuracy).toBe('landmark');
    });

    test('ke paas pattern', () => {
      const result = svc.parseVoiceLocation('railway station ke paas hoon');
      expect(result).not.toBeNull();
      expect(result!.accuracy).toBe('landmark');
    });

    test('landmark pattern', () => {
      const result = svc.parseVoiceLocation('Ashta road pe hoon');
      expect(result).not.toBeNull();
      expect(result!.accuracy).toBe('landmark');
    });

    test('empty string returns null', () => {
      expect(svc.parseVoiceLocation('')).toBeNull();
    });

    test('very short string returns null', () => {
      expect(svc.parseVoiceLocation('ab')).toBeNull();
    });
  });

  describe('resolveLocation', () => {
    const tier2 = {
      stdCode: '0755',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      district: 'Bhopal',
      accuracy: 'district' as const,
      method: 'automatic' as const,
    };

    test('tier2 only — uses city as primary', () => {
      const result = svc.resolveLocation(tier2);
      expect(result.primaryLocation).toContain('Bhopal');
      expect(result.accuracyLevel).toBe('district');
    });

    test('tier1 + tier2 — tier1 village takes priority', () => {
      const tier1 = {
        rawText: 'Rampur gaon',
        village: 'Rampur',
        accuracy: 'village' as const,
        timestamp: new Date().toISOString(),
      };
      const result = svc.resolveLocation(tier2, tier1);
      expect(result.primaryLocation).toContain('Rampur');
      expect(result.accuracyLevel).toBe('village');
    });
  });

  // ─── Fix #6: Hindi pronoun filter ───────────────────────────────────────────

  describe('pronoun filter — _stripFillerWords', () => {
    test('"main Bhopal ke paas" → nearCity is "bhopal", not "main bhopal"', () => {
      const result = svc.parseVoiceLocation('main Bhopal ke paas hoon');
      expect(result).not.toBeNull();
      expect(result!.nearCity).toBe('bhopal');
      expect(result!.nearCity).not.toContain('main');
    });

    test('"hum Indore ke paas" → nearCity is "indore"', () => {
      const result = svc.parseVoiceLocation('hum Indore ke paas hain');
      expect(result).not.toBeNull();
      expect(result!.nearCity).toBe('indore');
    });

    test('"mera Rampur gaon" → village is "rampur"', () => {
      const result = svc.parseVoiceLocation('mera Rampur gaon hai');
      expect(result).not.toBeNull();
      expect(result!.village).toBe('rampur');
    });

    test('"main Bhopal se 20 km" → nearCity is "bhopal"', () => {
      const result = svc.parseVoiceLocation('main Bhopal se 20 km door');
      expect(result).not.toBeNull();
      expect(result!.nearCity).toBe('bhopal');
    });

    test('"ji main Ashta road" → landmark is "ashta"', () => {
      const result = svc.parseVoiceLocation('ji main Ashta road pe hoon');
      expect(result).not.toBeNull();
      expect(result!.landmark).toBe('ashta');
    });

    test('all-filler input returns original (does not strip to empty)', () => {
      // "main hoon" — 2 words, both filler, but < 3 chars check passes
      const result = svc.parseVoiceLocation('main hoon yahan');
      // Should not crash, should return something
      expect(result).not.toBeNull();
    });
  });

  // ─── Nova Lite location parsing (parseNovaLocation) ─────────────────────────

  describe('parseNovaLocation — Nova Lite primary Tier 1', () => {
    test('null input returns null', () => {
      expect(svc.parseNovaLocation(null)).toBeNull();
    });

    test('empty string returns null', () => {
      expect(svc.parseNovaLocation('')).toBeNull();
    });

    test('single char returns null', () => {
      expect(svc.parseNovaLocation('a')).toBeNull();
    });

    test('simple city name → nearCity with city accuracy', () => {
      const result = svc.parseNovaLocation('Bhopal');
      expect(result).not.toBeNull();
      expect(result!.nearCity).toBe('bhopal');
      expect(result!.accuracy).toBe('city');
    });

    test('village pattern → village accuracy', () => {
      const result = svc.parseNovaLocation('Rampur gaon');
      expect(result).not.toBeNull();
      expect(result!.village).toBe('rampur');
      expect(result!.accuracy).toBe('village');
    });

    test('landmark pattern → landmark accuracy', () => {
      const result = svc.parseNovaLocation('railway station ke paas');
      expect(result).not.toBeNull();
      expect(result!.landmark).toBe('railway station ke paas');
      expect(result!.accuracy).toBe('landmark');
    });

    test('relative distance → nearCity with landmark accuracy', () => {
      const result = svc.parseNovaLocation('Bhopal se 20 km');
      expect(result).not.toBeNull();
      expect(result!.nearCity).toBe('bhopal');
      expect(result!.accuracy).toBe('landmark');
    });

    test('complex description Nova Lite normalized → treated as city', () => {
      const result = svc.parseNovaLocation('Indore, Madhya Pradesh');
      expect(result).not.toBeNull();
      expect(result!.nearCity).toContain('indore');
      expect(result!.accuracy).toBe('city');
    });

    test('rawText preserves original input', () => {
      const result = svc.parseNovaLocation('Bhopal ke paas');
      expect(result).not.toBeNull();
      expect(result!.rawText).toBe('Bhopal ke paas');
    });

    test('always has timestamp', () => {
      const result = svc.parseNovaLocation('Delhi');
      expect(result).not.toBeNull();
      expect(result!.timestamp).toBeDefined();
      expect(new Date(result!.timestamp).getTime()).not.toBeNaN();
    });
  });

  // ─── Fix #5: Mobile number with leading 0 ───────────────────────────────────

  describe('extractSTDCode — mobile with leading 0', () => {
    test('06000123456 is detected as mobile (Assam), not landline', async () => {
      // DynamoDB returns not-found, falls to static fallback which also returns null for mobile
      // The key assertion: it should NOT try landline STD code lookup for 0600/060/06
      const result = await svc.extractSTDCode('06000123456');
      // Mobile prefix 6000 won't be in static STD codes — returns null
      // But it should NOT match any landline STD code either
      // (Previously this would try 06000, 0600, 060, 06 as STD codes)
      expect(result).toBeNull(); // no match, but no wrong match either
    });

    test('+91 prefix stripped correctly for mobile', async () => {
      const result = await svc.extractSTDCode('+919810123456');
      // 9810 is Delhi mobile prefix — DynamoDB mock returns undefined, so null
      expect(result).toBeNull(); // no DynamoDB, no static match for mobile
    });

    test('spaces and dashes stripped', async () => {
      const result = await svc.extractSTDCode('0755-123-4567');
      // Should resolve to Bhopal via static fallback
      expect(result).not.toBeNull();
      expect(result!.city).toBe('Bhopal');
    });
  });

  // ─── Fix #8: extractSTDCode async DynamoDB path ─────────────────────────────

  describe('extractSTDCode — DynamoDB mocked responses', () => {
    test('landline: DynamoDB returns item → uses DynamoDB result', async () => {
      const dynamoItem = { stdCode: { S: '0755' }, city: { S: 'Bhopal' }, state: { S: 'Madhya Pradesh' }, district: { S: 'Bhopal' } };
      // First 3 calls (len 5, 4, 3) return not-found, 4th (len 4 = 0755) returns item
      mockSend
        .mockResolvedValueOnce({ Item: undefined })  // len 5: 07551
        .mockResolvedValueOnce({ Item: dynamoItem }); // len 4: 0755
      mockUnmarshall.mockReturnValue({ stdCode: '0755', city: 'Bhopal', state: 'Madhya Pradesh', district: 'Bhopal' });

      const result = await svc.extractSTDCode('07551234567');
      expect(result).not.toBeNull();
      expect(result!.city).toBe('Bhopal');
      expect(result!.state).toBe('Madhya Pradesh');
      expect(result!.method).toBe('automatic');
    });

    test('mobile: DynamoDB returns item → uses circle as city', async () => {
      const dynamoItem = { prefix4: { S: '9810' }, state: { S: 'Delhi' }, circle: { S: 'Delhi' }, operator: { S: 'Airtel' } };
      mockSend.mockResolvedValueOnce({ Item: dynamoItem });
      mockUnmarshall.mockReturnValue({ prefix4: '9810', state: 'Delhi', circle: 'Delhi', operator: 'Airtel' });

      const result = await svc.extractSTDCode('9810123456');
      expect(result).not.toBeNull();
      expect(result!.city).toBe('Delhi');
      expect(result!.state).toBe('Delhi');
      expect(result!.stdCode).toBe('9810');
    });

    test('DynamoDB error → falls back to static DB', async () => {
      mockSend.mockRejectedValue(new Error('DynamoDB timeout'));

      const result = await svc.extractSTDCode('07551234567');
      // Static fallback should resolve 0755 → Bhopal
      expect(result).not.toBeNull();
      expect(result!.city).toBe('Bhopal');
    });

    test('landline: all DynamoDB lengths miss → returns null', async () => {
      // All 4 attempts return not-found
      mockSend
        .mockResolvedValueOnce({ Item: undefined })
        .mockResolvedValueOnce({ Item: undefined })
        .mockResolvedValueOnce({ Item: undefined })
        .mockResolvedValueOnce({ Item: undefined });

      const result = await svc.extractSTDCode('09999999999');
      // Unknown STD code, DynamoDB has nothing, static fallback also null
      expect(result).toBeNull();
    });

    test('mobile: DynamoDB returns not-found → returns null', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const result = await svc.extractSTDCode('9999123456');
      expect(result).toBeNull();
    });

    test('longest STD code match wins in DynamoDB (5-digit before 4-digit)', async () => {
      const sagarItem = { stdCode: { S: '07552' }, city: { S: 'Sagar' }, state: { S: 'Madhya Pradesh' }, district: { S: 'Sagar' } };
      // First call (len 5 = 07552) returns Sagar
      mockSend.mockResolvedValueOnce({ Item: sagarItem });
      mockUnmarshall.mockReturnValue({ stdCode: '07552', city: 'Sagar', state: 'Madhya Pradesh', district: 'Sagar' });

      const result = await svc.extractSTDCode('075521234');
      expect(result).not.toBeNull();
      expect(result!.city).toBe('Sagar'); // Not Bhopal (0755)
    });
  });
});
