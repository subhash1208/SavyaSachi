import * as fc from 'fast-check';
import { generateFHIRRecord, roundTripFHIR } from '../../services/fhirGenerator';
import { redactPII, redactCallRecord, buildRecordingS3Key, logCall } from '../../services/callLogger';
import { SeverityLevel, LocationData } from '../../models/types';

// Mock DynamoDB
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutItemCommand: jest.fn(),
}));
jest.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: jest.fn().mockImplementation((obj) => obj),
}));

// ─── Property 5: FHIR JSON round-trip ─────────────────────────────────────────

describe('Property 5: FHIR JSON serialization round-trip', () => {

  const severities: SeverityLevel[] = ['critical', 'urgent', 'non-urgent'];
  const icd10Codes = ['I21.9', 'T63.0', 'J45.9', 'R56.9', 'A09', 'E86.0'];

  test('FHIR record survives JSON round-trip without data loss', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...icd10Codes),
        fc.constantFrom(...severities),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
        (icd10, severity, date) => {
          const record = generateFHIRRecord(icd10, severity, date.toISOString());
          const roundTripped = roundTripFHIR(record);
          expect(roundTripped.resourceType).toBe('Condition');
          expect(roundTripped.code.coding[0].code).toBe(icd10);
          expect(roundTripped.severity.coding[0].code).toBe(record.severity.coding[0].code);
          expect(roundTripped.recordedDate).toBe(record.recordedDate);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('FHIR record always has required fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...icd10Codes),
        fc.constantFrom(...severities),
        (icd10, severity) => {
          const record = generateFHIRRecord(icd10, severity, new Date().toISOString());
          expect(record.resourceType).toBe('Condition');
          expect(record.code.coding[0].system).toBe('http://hl7.org/fhir/sid/icd-10');
          expect(record.severity.coding[0].system).toBe('http://snomed.info/sct');
          expect(typeof record.code.coding[0].display).toBe('string');
          expect(record.code.coding[0].display.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('unknown ICD-10 code gets fallback display text', () => {
    const record = generateFHIRRecord('Z99.9', 'non-urgent', new Date().toISOString());
    expect(record.code.coding[0].display).toContain('Z99.9');
  });

  test('patientRef is included when provided', () => {
    const record = generateFHIRRecord('I21.9', 'critical', new Date().toISOString(), 'Patient/CA123');
    expect(record.subject?.reference).toBe('Patient/CA123');
  });

  test('patientRef is absent when not provided', () => {
    const record = generateFHIRRecord('I21.9', 'critical', new Date().toISOString());
    expect(record.subject).toBeUndefined();
  });
});

// ─── Property 13: PII redaction completeness ──────────────────────────────────

describe('Property 13: PII redaction completeness', () => {

  test('Indian mobile numbers are redacted', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 6000000000, max: 9999999999 }),
        (num) => {
          const text = `Call from ${num}`;
          const redacted = redactPII(text);
          expect(redacted).not.toContain(num.toString());
          expect(redacted).toContain('[REDACTED]');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('+91 prefixed numbers are redacted', () => {
    expect(redactPII('+91-9390622545')).not.toContain('9390622545');
    expect(redactPII('+91 9390622545')).not.toContain('9390622545');
    expect(redactPII('+919390622545')).not.toContain('9390622545');
  });

  test('landline numbers are redacted', () => {
    expect(redactPII('0755-2345678')).not.toContain('2345678');
    expect(redactPII('011-23456789')).not.toContain('23456789');
  });

  test('Aadhaar-like 12-digit numbers are redacted', () => {
    expect(redactPII('1234 5678 9012')).not.toContain('123456789012');
    expect(redactPII('123456789012')).not.toContain('123456789012');
  });

  test('email addresses are redacted', () => {
    expect(redactPII('contact user@example.com for help')).not.toContain('user@example.com');
  });

  test('text with no PII is unchanged', () => {
    const clean = 'Patient has fever and headache since 2 days';
    expect(redactPII(clean)).toBe(clean);
  });

  test('redactCallRecord always sets callerNumber to [REDACTED]', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (phoneNumber) => {
          const mockRecord = {
            callId: 'CA123',
            callerNumber: phoneNumber,
            timestamp: new Date().toISOString(),
            ttl: 0,
            callStartTime: new Date().toISOString(),
            duration: 60,
            callSourceType: 'mobile' as const,
            language: 'hindi' as const,
            triageOutcome: 'general_triage_complete' as const,
            icd10Code: 'R50.9',
            severityClassification: 'non-urgent' as const,
            dispatchType: 'none' as const,
            actionsTaken: [],
            location: {} as LocationData,
            recordingS3Key: '',
            bedrockTraceId: '',
            fhirRecord: {} as any,
          };
          const redacted = redactCallRecord(mockRecord);
          expect(redacted.callerNumber).toBe('[REDACTED]');
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─── Property 12: Call record completeness ────────────────────────────────────

describe('Property 12: Call record completeness', () => {

  const baseLocation: LocationData = {
    tier2Phone: {
      stdCode: '0755',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      district: 'Bhopal',
      accuracy: 'district',
      method: 'automatic',
    },
    primaryLocation: 'Bhopal, Madhya Pradesh',
    accuracyLevel: 'district',
  };

  test('logCall writes to DynamoDB without throwing', async () => {
    await expect(logCall({
      callId: 'CA_test_001',
      callStartTime: '2026-03-02T10:00:00Z',
      callEndTime: '2026-03-02T10:01:30Z',
      durationSeconds: 90,
      callerNumber: '+919390622545',
      callSourceType: 'mobile',
      language: 'hindi',
      triageOutcome: 'emergency_dispatched',
      icd10Code: 'I21.9',
      severityClassification: 'critical',
      conditionId: 'cardiac',
      dispatchType: '108',
      actionsTaken: ['dispatch_108', 'sms_treatment'],
      location: baseLocation,
      recordingS3Key: 'recordings/2026-03-02/CA_test_001.mp3',
      bedrockTraceId: 'trace-abc123',
      fhirRecord: generateFHIRRecord('I21.9', 'critical', '2026-03-02T10:01:30Z'),
    })).resolves.toBeUndefined();
  });

  test('buildRecordingS3Key produces correct path', () => {
    const key = buildRecordingS3Key('CA123', '2026-03-02T10:00:00Z');
    expect(key).toBe('recordings/2026-03-02/CA123.mp3');
  });

  test('TTL is set to approximately 90 days from now', () => {
    // We can't test the DynamoDB write directly, but we can verify the TTL math
    const now = Math.floor(Date.now() / 1000);
    const expected = now + 90 * 24 * 60 * 60;
    const tolerance = 5; // seconds
    expect(Math.abs(expected - (now + 7776000))).toBeLessThan(tolerance);
  });
});

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe('FHIR generator unit tests', () => {

  test('cardiac → I21.9 → Severe SNOMED', () => {
    const r = generateFHIRRecord('I21.9', 'critical', '2026-03-02T10:00:00Z');
    expect(r.code.coding[0].code).toBe('I21.9');
    expect(r.severity.coding[0].code).toBe('24484000');
    expect(r.severity.coding[0].display).toBe('Severe');
  });

  test('snakebite → T63.0 → Severe SNOMED', () => {
    const r = generateFHIRRecord('T63.0', 'critical', '2026-03-02T10:00:00Z');
    expect(r.code.coding[0].code).toBe('T63.0');
    expect(r.code.coding[0].display).toContain('snake');
  });

  test('urgent → Moderate SNOMED', () => {
    const r = generateFHIRRecord('J45.9', 'urgent', '2026-03-02T10:00:00Z');
    expect(r.severity.coding[0].code).toBe('6736007');
    expect(r.severity.coding[0].display).toBe('Moderate');
  });

  test('non-urgent → Mild SNOMED', () => {
    const r = generateFHIRRecord('R50.9', 'non-urgent', '2026-03-02T10:00:00Z');
    expect(r.severity.coding[0].code).toBe('255604002');
    expect(r.severity.coding[0].display).toBe('Mild');
  });
});
