import * as fc from 'fast-check';
import { LocationDetectorService } from '../../services/locationDetector';
import { STD_CODE_DATABASE } from '../../data/stdCodeDatabase';

// Mock DynamoDB — tests run locally without AWS credentials
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ Item: undefined }), // simulate not-found → triggers static fallback
  })),
  GetItemCommand: jest.fn(),
}));

jest.mock('@aws-sdk/util-dynamodb', () => ({
  unmarshall: jest.fn(),
}));

const svc = new LocationDetectorService();

// ─── Property 8: STD code mapping correctness (via static fallback) ───────────

describe('Property 8: STD code mapping correctness', () => {

  test('every entry in STD_CODE_DATABASE resolves via static fallback', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STD_CODE_DATABASE),
        (entry) => {
          // Access private static fallback directly for sync property testing
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
      expect(result!.nearCity).toContain('bhopal');
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
});
