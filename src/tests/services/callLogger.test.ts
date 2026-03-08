import * as fc from 'fast-check';
import { generateFHIRRecord, roundTripFHIR } from '../../services/fhirGenerator';
import {
  redactPII, redactCallRecord, buildRecordingS3Key,
  CallLoggerService,
} from '../../services/callLogger';
import {
  SeverityLevel, LocationData, CallRecord, FHIRCondition, TriageResult,
} from '../../models/types';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

// ─── DynamoDB mock ────────────────────────────────────────────────────────────

const ddbMock = mockClient(DynamoDBClient);

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(PutItemCommand).resolves({});
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

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

function makeCallRecord(overrides?: Partial<CallRecord>): CallRecord {
  return {
    callId: 'CA_test_001',
    timestamp: '2026-03-02T10:01:30Z',
    ttl: Math.floor(Date.now() / 1000) + 7776000,
    callerNumber: '+919876543210',
    callSourceType: 'mobile',
    language: 'hindi',
    duration: 90,
    triageOutcome: 'emergency_dispatched',
    conditionId: 'cardiac',
    icd10Code: 'I21.9',
    severityClassification: 'critical',
    dispatchType: '108',
    actionsTaken: ['dispatch_108', 'sms_treatment'],
    location: baseLocation,
    recordingS3Key: 'recordings/2026-03-02/CA_test_001.mp3',
    bedrockTraceId: 'trace-abc123',
    fhirRecord: generateFHIRRecord('I21.9', 'critical', '2026-03-02T10:01:30Z'),
    ...overrides,
  };
}

function makeTriageResult(overrides?: Partial<TriageResult>): TriageResult {
  return {
    callId: 'CA_test_001',
    isEmergency: true,
    condition: 'cardiac',
    icd10Code: 'I21.9',
    severity: 'critical',
    recommendedCareLevel: 'district_hospital',
    treatmentAdvice: [{ hindi: 'CPR shuru karein', english: 'Start CPR' }],
    dispatchType: '108',
    followUpRequired: false,
    ashaAlertRequired: true,
    ...overrides,
  };
}

// ─── Property 5: FHIR JSON serialization round-trip ───────────────────────────

describe('Property 5: FHIR JSON serialization round-trip', () => {

  const severities: SeverityLevel[] = ['critical', 'urgent', 'non-urgent'];
  const icd10Codes = ['I21.9', 'T63.0', 'J45.9', 'R56.9', 'A09', 'E86.0', 'R69', 'Z87.39'];

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

  test('R69 fallback code has proper display name', () => {
    const record = generateFHIRRecord('R69', 'non-urgent', new Date().toISOString());
    expect(record.code.coding[0].display).toBe('Illness, unspecified');
  });

  test('patientRef is included when provided', () => {
    const record = generateFHIRRecord('I21.9', 'critical', new Date().toISOString(), 'Patient/CA123');
    expect(record.subject?.reference).toBe('Patient/CA123');
  });

  test('patientRef is absent when not provided', () => {
    const record = generateFHIRRecord('I21.9', 'critical', new Date().toISOString());
    expect(record.subject).toBeUndefined();
  });

  test('all 3 severity levels map to valid SNOMED codes', () => {
    const expected: Record<SeverityLevel, string> = {
      critical: '24484000',
      urgent: '6736007',
      'non-urgent': '255604002',
    };
    for (const [sev, snomed] of Object.entries(expected)) {
      const r = generateFHIRRecord('I21.9', sev as SeverityLevel, new Date().toISOString());
      expect(r.severity.coding[0].code).toBe(snomed);
    }
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
    expect(redactPII('Aadhaar 1234 5678 9012')).not.toContain('1234 5678 9012');
    expect(redactPII('Aadhaar 123456789012')).not.toContain('123456789012');
  });

  test('email addresses are redacted', () => {
    expect(redactPII('contact user@example.com for help')).not.toContain('user@example.com');
  });

  test('text with no PII is unchanged', () => {
    const clean = 'Patient has fever and headache since 2 days';
    expect(redactPII(clean)).toBe(clean);
  });

  test('multiple PII types in one string are all redacted', () => {
    const text = 'Call from 9876543210, email test@mail.com, Aadhaar 1234 5678 9012';
    const redacted = redactPII(text);
    expect(redacted).not.toContain('9876543210');
    expect(redacted).not.toContain('test@mail.com');
    expect(redacted).not.toContain('1234 5678 9012');
  });

  test('redactCallRecord always sets callerNumber to [REDACTED]', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (phoneNumber) => {
          const record = makeCallRecord({ callerNumber: phoneNumber });
          const redacted = redactCallRecord(record);
          expect(redacted.callerNumber).toBe('[REDACTED]');
        }
      ),
      { numRuns: 50 }
    );
  });

  test('redactCallRecord preserves all non-PII fields', () => {
    const record = makeCallRecord();
    const redacted = redactCallRecord(record);
    expect(redacted.callId).toBe(record.callId);
    expect(redacted.icd10Code).toBe(record.icd10Code);
    expect(redacted.severityClassification).toBe(record.severityClassification);
    expect(redacted.triageOutcome).toBe(record.triageOutcome);
    expect(redacted.location).toEqual(record.location);
  });
});

// ─── Property 12: Call record completeness ────────────────────────────────────

describe('Property 12: Call record completeness', () => {

  test('logCall writes to DynamoDB without throwing', async () => {
    const service = new CallLoggerService(new DynamoDBClient({}));
    await expect(service.logCall(makeCallRecord())).resolves.toBeUndefined();
  });

  test('logCall always redacts callerNumber before DynamoDB write', async () => {
    const service = new CallLoggerService(new DynamoDBClient({}));
    await service.logCall(makeCallRecord({ callerNumber: '+919876543210' }));

    const calls = ddbMock.commandCalls(PutItemCommand);
    expect(calls.length).toBe(1);
    const writtenItem = calls[0].args[0].input.Item;
    // marshall wraps strings in { S: "value" } — check the DynamoDB attribute
    expect((writtenItem as any).callerNumber).toEqual({ S: '[REDACTED]' });
  });

  test('logCall does NOT throw on DynamoDB failure — swallows error', async () => {
    ddbMock.on(PutItemCommand).rejects(new Error('DynamoDB timeout'));
    const service = new CallLoggerService(new DynamoDBClient({}));
    // Should NOT throw — logging failure must not crash the call
    await expect(service.logCall(makeCallRecord())).resolves.toBeUndefined();
  });

  test('logCall sets TTL to approximately 90 days from now', async () => {
    const service = new CallLoggerService(new DynamoDBClient({}));
    await service.logCall(makeCallRecord());

    const calls = ddbMock.commandCalls(PutItemCommand);
    const writtenItem = calls[0].args[0].input.Item as any;
    const now = Math.floor(Date.now() / 1000);
    const expectedTTL = now + 90 * 24 * 60 * 60;
    // marshall wraps numbers in { N: "value" } — parse the string back
    const actualTTL = Number(writtenItem.ttl.N);
    expect(Math.abs(actualTTL - expectedTTL)).toBeLessThan(5);
  });

  test('buildRecordingS3Key produces correct path', () => {
    const key = buildRecordingS3Key('CA123', '2026-03-02T10:00:00Z');
    expect(key).toBe('recordings/2026-03-02/CA123.mp3');
  });

  test('buildRecordingS3Key handles different date formats', () => {
    expect(buildRecordingS3Key('CA1', '2026-12-31T23:59:59Z')).toBe('recordings/2026-12-31/CA1.mp3');
    expect(buildRecordingS3Key('CA2', '2026-01-01')).toBe('recordings/2026-01-01/CA2.mp3');
  });
});

// ─── CallLoggerService class tests ────────────────────────────────────────────

describe('CallLoggerService implements ICallLogger', () => {

  test('storeRecording returns a valid S3 key (stub)', async () => {
    const service = new CallLoggerService(new DynamoDBClient({}));
    const key = await service.storeRecording('CA_test_001', Buffer.from('audio'));
    expect(key).toMatch(/^recordings\/\d{4}-\d{2}-\d{2}\/CA_test_001\.mp3$/);
  });

  test('redactPII delegates to redactCallRecord', () => {
    const service = new CallLoggerService(new DynamoDBClient({}));
    const record = makeCallRecord({ callerNumber: '+919876543210' });
    const redacted = service.redactPII(record);
    expect(redacted.callerNumber).toBe('[REDACTED]');
    expect(redacted.callId).toBe(record.callId);
  });

  test('generateFHIRRecord creates FHIR from TriageResult', () => {
    const service = new CallLoggerService(new DynamoDBClient({}));
    const triage = makeTriageResult();
    const fhir = service.generateFHIRRecord(triage);
    expect(fhir.resourceType).toBe('Condition');
    expect(fhir.code.coding[0].code).toBe('I21.9');
    expect(fhir.severity.coding[0].code).toBe('24484000'); // critical → Severe
  });

  test('generateFHIRRecord handles R69 unknown condition', () => {
    const service = new CallLoggerService(new DynamoDBClient({}));
    const triage = makeTriageResult({ icd10Code: 'R69', severity: 'non-urgent' });
    const fhir = service.generateFHIRRecord(triage);
    expect(fhir.code.coding[0].code).toBe('R69');
    expect(fhir.code.coding[0].display).toBe('Illness, unspecified');
  });

  test('generateFHIRRecord with non-urgent severity', () => {
    const service = new CallLoggerService(new DynamoDBClient({}));
    const triage = makeTriageResult({ icd10Code: 'R50.9', severity: 'non-urgent' });
    const fhir = service.generateFHIRRecord(triage);
    expect(fhir.severity.coding[0].code).toBe('255604002'); // Mild
  });
});

// ─── FHIR generator unit tests ───────────────────────────────────────────────

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

  test('dengue A90 has correct display', () => {
    const r = generateFHIRRecord('A90', 'urgent', '2026-03-02T10:00:00Z');
    expect(r.code.coding[0].display).toBe('Dengue fever');
  });

  test('diabetes E11.9 has correct display', () => {
    const r = generateFHIRRecord('E11.9', 'non-urgent', '2026-03-02T10:00:00Z');
    expect(r.code.coding[0].display).toContain('diabetes');
  });

  test('unknown severity falls back to non-urgent SNOMED', () => {
    // TypeScript prevents this at compile time, but runtime safety matters
    const r = generateFHIRRecord('I21.9', 'bogus' as SeverityLevel, '2026-03-02T10:00:00Z');
    expect(r.severity.coding[0].code).toBe('255604002'); // non-urgent fallback
  });
});


// ─── Improvement tests (round 2) ─────────────────────────────────────────────

describe('Improvement: conditionId in CallRecord (Req 2.11)', () => {

  test('conditionId is persisted to DynamoDB', async () => {
    const service = new CallLoggerService(new DynamoDBClient({}));
    await service.logCall(makeCallRecord({ conditionId: 'maternal_care' }));

    const calls = ddbMock.commandCalls(PutItemCommand);
    const writtenItem = calls[0].args[0].input.Item as any;
    expect(writtenItem.conditionId).toEqual({ S: 'maternal_care' });
  });

  test('conditionId preserved through redaction', () => {
    const record = makeCallRecord({ conditionId: 'cardiac' });
    const redacted = redactCallRecord(record);
    expect(redacted.conditionId).toBe('cardiac');
  });
});

describe('Improvement: deep PII redaction in location.tier1Voice.rawText', () => {

  test('phone number in rawText is redacted', () => {
    const locationWithPII: LocationData = {
      ...baseLocation,
      tier1Voice: {
        rawText: 'main 9876543210 se bol raha hoon Bhopal mein',
        nearCity: 'bhopal',
        accuracy: 'city',
        timestamp: new Date().toISOString(),
      },
    };
    const record = makeCallRecord({ location: locationWithPII });
    const redacted = redactCallRecord(record);
    expect(redacted.location.tier1Voice?.rawText).not.toContain('9876543210');
    expect(redacted.location.tier1Voice?.rawText).toContain('[REDACTED]');
    // nearCity should be preserved
    expect(redacted.location.tier1Voice?.nearCity).toBe('bhopal');
  });

  test('rawText without PII is unchanged', () => {
    const locationClean: LocationData = {
      ...baseLocation,
      tier1Voice: {
        rawText: 'Bhopal ke paas ek gaon mein',
        nearCity: 'bhopal',
        accuracy: 'city',
        timestamp: new Date().toISOString(),
      },
    };
    const record = makeCallRecord({ location: locationClean });
    const redacted = redactCallRecord(record);
    expect(redacted.location.tier1Voice?.rawText).toBe('Bhopal ke paas ek gaon mein');
  });

  test('no tier1Voice — no crash', () => {
    const record = makeCallRecord(); // baseLocation has no tier1Voice
    const redacted = redactCallRecord(record);
    expect(redacted.location.tier1Voice).toBeUndefined();
  });
});

describe('Improvement: ICD-10 display coverage for all triageAgent codes', () => {

  test('maternal_care Z34.9 has proper display', () => {
    const r = generateFHIRRecord('Z34.9', 'non-urgent', new Date().toISOString());
    expect(r.code.coding[0].display).toContain('pregnancy');
  });

  test('headache R51 has proper display', () => {
    const r = generateFHIRRecord('R51', 'non-urgent', new Date().toISOString());
    expect(r.code.coding[0].display).toBe('Headache');
  });
});
