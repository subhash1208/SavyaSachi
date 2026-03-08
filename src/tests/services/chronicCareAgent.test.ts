import * as fc from 'fast-check';
import { ChronicCareAgentService } from '../../services/chronicCareAgent';
import { IASHAWorkerRepository, IASHASmsClient, ASHAWorkerRecord } from '../../services/ashaWorkerAgent';
import { ChronicCondition } from '../../models/enums';
import { CallRecord, MonitoringChecklist } from '../../models/types';
import { IChronicCareAgent } from '../../interfaces/IChronicCareAgent';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const MOCK_ASHA: ASHAWorkerRecord = {
  ashaWorkerId: 'asha-001',
  name: 'Sunita Devi',
  phone: '+919876543210',
  village: 'Khedi',
  block: 'Vidisha Block',
  district: 'Vidisha',
  state: 'Madhya Pradesh',
};

function makeCallRecord(overrides: Partial<CallRecord> = {}): CallRecord {
  return {
    callId: 'call-test-001',
    timestamp: '2026-03-06T10:00:00Z',
    ttl: 1741262400,
    callerNumber: '+919876500001',
    callSourceType: 'mobile',
    language: 'hindi',
    duration: 180,
    triageOutcome: 'general_triage_complete',
    conditionId: 'diabetes',
    icd10Code: 'E11.9',
    severityClassification: 'non-urgent',
    dispatchType: 'none',
    actionsTaken: ['chronic_enrollment'],
    location: {
      primaryLocation: 'Vidisha, Madhya Pradesh',
      accuracyLevel: 'village',
      tier2Phone: { stdCode: '07592', city: 'Vidisha', district: 'Vidisha', state: 'Madhya Pradesh', accuracy: 'district', method: 'automatic' },
      tier1Voice: { rawText: 'Khedi village', village: 'Khedi', district: 'Vidisha', state: 'Madhya Pradesh', accuracy: 'village', timestamp: '2026-03-06T10:00:00Z' },
    },
    recordingS3Key: 's3://recordings/call-test-001.wav',
    bedrockTraceId: 'trace-001',
    fhirRecord: {
      resourceType: 'Condition',
      code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'E11.9', display: 'Type 2 diabetes mellitus' }] },
      recordedDate: '2026-03-06T10:00:00Z',
      severity: { coding: [{ system: 'http://snomed.info/sct', code: '6736007', display: 'Moderate' }] },
    },
    ...overrides,
  };
}

function makeMockRepo(asha: ASHAWorkerRecord | null = MOCK_ASHA): IASHAWorkerRepository {
  return {
    findByLocation: jest.fn().mockResolvedValue(asha),
    findById: jest.fn().mockResolvedValue(asha),
  };
}

function makeMockSms(): IASHASmsClient & { published: Array<{ PhoneNumber: string; Message: string }> } {
  const published: Array<{ PhoneNumber: string; Message: string }> = [];
  return {
    published,
    publish: jest.fn().mockImplementation(async (params) => { published.push(params); }),
  };
}

// ─── Interface compliance ─────────────────────────────────────────────────────

describe('Interface compliance', () => {
  it('ChronicCareAgentService implements IChronicCareAgent', () => {
    const svc: IChronicCareAgent = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    expect(typeof svc.enrollPatient).toBe('function');
    expect(typeof svc.getMonitoringChecklist).toBe('function');
    expect(typeof svc.getFullChecklist).toBe('function');
  });

  it('getFullChecklist is accessible via IChronicCareAgent interface', () => {
    const svc: IChronicCareAgent = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    // Call handler uses the interface — must be able to call getFullChecklist through it
    const cl = svc.getFullChecklist('diabetes');
    expect(cl.frequency).toBe('weekly');
    expect(cl.alertThresholds.length).toBeGreaterThan(0);
  });
});

// ─── getMonitoringChecklist ───────────────────────────────────────────────────

describe('getMonitoringChecklist', () => {
  const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());

  it('diabetes checklist contains blood sugar check', () => {
    const items = svc.getMonitoringChecklist('diabetes');
    expect(items.some(i => i.toLowerCase().includes('blood sugar'))).toBe(true);
  });

  it('hypertension checklist contains blood pressure', () => {
    const items = svc.getMonitoringChecklist('hypertension');
    expect(items.some(i => i.toLowerCase().includes('blood pressure'))).toBe(true);
  });

  it('tb checklist contains DOT / medication', () => {
    const items = svc.getMonitoringChecklist('tb');
    expect(items.some(i => i.toLowerCase().includes('dot') || i.toLowerCase().includes('medication'))).toBe(true);
  });

  it('each condition returns at least 3 items', () => {
    const conditions: ChronicCondition[] = ['diabetes', 'hypertension', 'tb'];
    for (const c of conditions) {
      expect(svc.getMonitoringChecklist(c).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('diabetes checklist does NOT contain BP monitoring', () => {
    const items = svc.getMonitoringChecklist('diabetes');
    // Diabetes checklist must not bleed hypertension items
    expect(items.some(i => i.toLowerCase().includes('blood pressure'))).toBe(false);
  });

  it('hypertension checklist does NOT contain DOT', () => {
    const items = svc.getMonitoringChecklist('hypertension');
    expect(items.some(i => i.toLowerCase().includes('dot'))).toBe(false);
  });

  it('tb checklist does NOT contain blood sugar', () => {
    const items = svc.getMonitoringChecklist('tb');
    expect(items.some(i => i.toLowerCase().includes('blood sugar'))).toBe(false);
  });

  it('all items are bilingual (contain / separator)', () => {
    const conditions: ChronicCondition[] = ['diabetes', 'hypertension', 'tb'];
    for (const c of conditions) {
      const items = svc.getMonitoringChecklist(c);
      for (const item of items) {
        expect(item).toContain('/');
      }
    }
  });
});

// ─── getFullChecklist ─────────────────────────────────────────────────────────

describe('getFullChecklist', () => {
  const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());

  it('diabetes: weekly frequency', () => {
    const cl = svc.getFullChecklist('diabetes');
    expect(cl.frequency).toBe('weekly');
  });

  it('hypertension: weekly frequency', () => {
    const cl = svc.getFullChecklist('hypertension');
    expect(cl.frequency).toBe('weekly');
  });

  it('tb: daily frequency (DOT requires daily observation)', () => {
    const cl = svc.getFullChecklist('tb');
    expect(cl.frequency).toBe('daily');
  });

  it('all checklists have alert thresholds', () => {
    const conditions: ChronicCondition[] = ['diabetes', 'hypertension', 'tb'];
    for (const c of conditions) {
      const cl = svc.getFullChecklist(c);
      expect(cl.alertThresholds.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('diabetes thresholds include hypoglycemia emergency', () => {
    const cl = svc.getFullChecklist('diabetes');
    expect(cl.alertThresholds.some(t => t.toLowerCase().includes('hypoglycemia') || t.includes('< 70'))).toBe(true);
  });

  it('hypertension thresholds include 108 for hypertensive crisis', () => {
    const cl = svc.getFullChecklist('hypertension');
    expect(cl.alertThresholds.some(t => t.includes('108'))).toBe(true);
  });

  it('tb thresholds include missed medication escalation', () => {
    const cl = svc.getFullChecklist('tb');
    expect(cl.alertThresholds.some(t => t.toLowerCase().includes('missed'))).toBe(true);
  });
});

// ─── enrollPatient ────────────────────────────────────────────────────────────

describe('enrollPatient', () => {
  it('returns enrollment with correct ICD-10 for diabetes (E11.9)', async () => {
    const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    const enrollment = await svc.enrollPatient(makeCallRecord(), 'diabetes');
    expect(enrollment.icd10Code).toBe('E11.9');
    expect(enrollment.condition).toBe('diabetes');
  });

  it('returns enrollment with correct ICD-10 for hypertension (I10)', async () => {
    const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    const enrollment = await svc.enrollPatient(makeCallRecord(), 'hypertension');
    expect(enrollment.icd10Code).toBe('I10');
    expect(enrollment.condition).toBe('hypertension');
  });

  it('returns enrollment with correct ICD-10 for TB (A15.0)', async () => {
    const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    const enrollment = await svc.enrollPatient(makeCallRecord(), 'tb');
    expect(enrollment.icd10Code).toBe('A15.0');
    expect(enrollment.condition).toBe('tb');
  });

  it('assigns ASHA worker from repo lookup', async () => {
    const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    const enrollment = await svc.enrollPatient(makeCallRecord(), 'diabetes');
    expect(enrollment.assignedAshaWorkerId).toBe('asha-001');
    expect(enrollment.assignedAshaWorkerPhone).toBe('+919876543210');
  });

  it('enrollment includes monitoring checklist items', async () => {
    const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    const enrollment = await svc.enrollPatient(makeCallRecord(), 'diabetes');
    expect(enrollment.monitoringChecklist.length).toBeGreaterThan(0);
    expect(enrollment.monitoringChecklist.some(i => i.toLowerCase().includes('blood sugar'))).toBe(true);
  });

  it('enrollment includes monitoring schedule', async () => {
    const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    const enrollment = await svc.enrollPatient(makeCallRecord(), 'tb');
    expect(enrollment.monitoringSchedule).toContain('DOT');
  });

  it('enrollment date is a valid ISO timestamp', async () => {
    const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    const enrollment = await svc.enrollPatient(makeCallRecord(), 'diabetes');
    expect(() => new Date(enrollment.enrollmentDate)).not.toThrow();
    expect(new Date(enrollment.enrollmentDate).getTime()).toBeGreaterThan(0);
  });

  it('sends SMS to ASHA worker on enrollment', async () => {
    const sms = makeMockSms();
    const svc = new ChronicCareAgentService(makeMockRepo(), sms);
    await svc.enrollPatient(makeCallRecord(), 'diabetes');
    expect(sms.published.length).toBe(1);
    expect(sms.published[0].PhoneNumber).toBe('+919876543210');
  });

  it('SMS contains condition label and checklist items', async () => {
    const sms = makeMockSms();
    const svc = new ChronicCareAgentService(makeMockRepo(), sms);
    await svc.enrollPatient(makeCallRecord(), 'diabetes');
    const msg = sms.published[0].Message;
    expect(msg).toContain('Diabetes');
    expect(msg).toContain('E11.9');
    expect(msg).toContain('blood sugar');
  });

  it('SMS contains alert thresholds', async () => {
    const sms = makeMockSms();
    const svc = new ChronicCareAgentService(makeMockRepo(), sms);
    await svc.enrollPatient(makeCallRecord(), 'hypertension');
    const msg = sms.published[0].Message;
    expect(msg).toContain('⚠');
  });

  it('no ASHA found — enrollment still succeeds with unassigned marker', async () => {
    const svc = new ChronicCareAgentService(makeMockRepo(null), makeMockSms());
    const enrollment = await svc.enrollPatient(makeCallRecord(), 'diabetes');
    expect(enrollment.assignedAshaWorkerId).toBe('unassigned');
    expect(enrollment.assignedAshaWorkerPhone).toBe('');
    // enrollment record is still valid — DynamoDB persistence can proceed
    expect(enrollment.icd10Code).toBe('E11.9');
  });

  it('no ASHA found — no SMS sent', async () => {
    const sms = makeMockSms();
    const svc = new ChronicCareAgentService(makeMockRepo(null), sms);
    await svc.enrollPatient(makeCallRecord(), 'diabetes');
    expect(sms.published.length).toBe(0);
  });

  it('SMS failure does NOT throw — enrollment record still returned', async () => {
    const failingSms: IASHASmsClient = {
      publish: jest.fn().mockRejectedValue(new Error('SNS timeout')),
    };
    const svc = new ChronicCareAgentService(makeMockRepo(), failingSms);
    // Must not throw even if SMS fails
    const enrollment = await expect(svc.enrollPatient(makeCallRecord(), 'diabetes')).resolves.toBeDefined();
  });

  it('uses tier2Phone district when tier1Voice is absent', async () => {
    const repo = makeMockRepo();
    const svc = new ChronicCareAgentService(repo, makeMockSms());
    const record = makeCallRecord();
    // Remove tier1Voice
    delete (record.location as any).tier1Voice;
    await svc.enrollPatient(record, 'diabetes');
    expect(repo.findByLocation).toHaveBeenCalledWith('Vidisha', undefined);
  });

  it('uses tier1Voice district when available', async () => {
    const repo = makeMockRepo();
    const svc = new ChronicCareAgentService(repo, makeMockSms());
    await svc.enrollPatient(makeCallRecord(), 'diabetes');
    expect(repo.findByLocation).toHaveBeenCalledWith('Vidisha', 'Khedi');
  });

  it('patientId matches callRecord.callId', async () => {
    const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    const record = makeCallRecord({ callId: 'call-xyz-999' });
    const enrollment = await svc.enrollPatient(record, 'hypertension');
    expect(enrollment.patientId).toBe('call-xyz-999');
  });

  it('callerNumber is preserved in enrollment', async () => {
    const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    const record = makeCallRecord({ callerNumber: '+919988776655' });
    const enrollment = await svc.enrollPatient(record, 'tb');
    expect(enrollment.callerNumber).toBe('+919988776655');
  });

  it('F1: DynamoDB repo throws — enrollment still succeeds with unassigned marker', async () => {
    const failingRepo: IASHAWorkerRepository = {
      findByLocation: jest.fn().mockRejectedValue(new Error('DynamoDB timeout')),
      findById: jest.fn().mockResolvedValue(null),
    };
    const svc = new ChronicCareAgentService(failingRepo, makeMockSms());
    // Must not throw — enrollment proceeds without ASHA assignment
    const enrollment = await svc.enrollPatient(makeCallRecord(), 'diabetes');
    expect(enrollment.icd10Code).toBe('E11.9');
    expect(enrollment.assignedAshaWorkerId).toBe('unassigned');
  });
});

// ─── Property 16: Chronic care ASHA assignment ───────────────────────────────
//
// For any valid CallRecord + ChronicCondition, enrollPatient() MUST:
// - Return an enrollment with a non-empty patientId
// - Return an enrollment with a non-empty icd10Code
// - Return an enrollment with a non-empty monitoringChecklist
// - Return an enrollment with a non-empty monitoringSchedule
// - Never throw
//
// Validates: Req 11.1

describe('Property 16: Chronic care ASHA assignment', () => {
  const conditions: ChronicCondition[] = ['diabetes', 'hypertension', 'tb'];

  it('for any condition, enrollment always has required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...conditions),
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 13 }),
        async (condition, callId, callerNumber) => {
          const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
          const record = makeCallRecord({ callId, callerNumber });
          const enrollment = await svc.enrollPatient(record, condition);

          expect(enrollment.patientId).toBeTruthy();
          expect(enrollment.icd10Code).toBeTruthy();
          expect(enrollment.condition).toBe(condition);
          expect(enrollment.monitoringChecklist.length).toBeGreaterThan(0);
          expect(enrollment.monitoringSchedule.length).toBeGreaterThan(0);
          expect(enrollment.enrollmentDate).toBeTruthy();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any condition, enrollment never throws even when ASHA not found', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...conditions),
        async (condition) => {
          const svc = new ChronicCareAgentService(makeMockRepo(null), makeMockSms());
          const enrollment = await svc.enrollPatient(makeCallRecord(), condition);
          // Must not throw, must return valid enrollment
          expect(enrollment.icd10Code).toBeTruthy();
          expect(enrollment.assignedAshaWorkerId).toBe('unassigned');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('for any condition, enrollment ICD-10 is always a valid format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...conditions),
        async (condition) => {
          const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
          const enrollment = await svc.enrollPatient(makeCallRecord(), condition);
          // ICD-10 format: letter + 2 digits + optional decimal
          expect(enrollment.icd10Code).toMatch(/^[A-Z]\d{2}(\.\d+)?$/);
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ─── Property 17: ASHA monitoring checklist condition matching ────────────────
//
// For each ChronicCondition, getMonitoringChecklist() MUST return items
// that are specific to that condition and NOT items from other conditions.
//
// Validates: Req 11.2

describe('Property 17: ASHA monitoring checklist condition matching', () => {
  const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());

  it('diabetes checklist never contains BP or DOT items', () => {
    fc.assert(
      fc.property(fc.constant('diabetes' as ChronicCondition), (condition) => {
        const items = svc.getMonitoringChecklist(condition);
        const hasBloodPressure = items.some(i => i.toLowerCase().includes('blood pressure'));
        const hasDOT = items.some(i => i.toLowerCase().includes('dot'));
        expect(hasBloodPressure).toBe(false);
        expect(hasDOT).toBe(false);
      }),
      { numRuns: 10 },
    );
  });

  it('hypertension checklist never contains blood sugar or DOT items', () => {
    fc.assert(
      fc.property(fc.constant('hypertension' as ChronicCondition), (condition) => {
        const items = svc.getMonitoringChecklist(condition);
        const hasBloodSugar = items.some(i => i.toLowerCase().includes('blood sugar'));
        const hasDOT = items.some(i => i.toLowerCase().includes('dot'));
        expect(hasBloodSugar).toBe(false);
        expect(hasDOT).toBe(false);
      }),
      { numRuns: 10 },
    );
  });

  it('tb checklist never contains blood sugar or blood pressure items', () => {
    fc.assert(
      fc.property(fc.constant('tb' as ChronicCondition), (condition) => {
        const items = svc.getMonitoringChecklist(condition);
        const hasBloodSugar = items.some(i => i.toLowerCase().includes('blood sugar'));
        const hasBloodPressure = items.some(i => i.toLowerCase().includes('blood pressure'));
        expect(hasBloodSugar).toBe(false);
        expect(hasBloodPressure).toBe(false);
      }),
      { numRuns: 10 },
    );
  });

  it('all conditions always return non-empty checklists', () => {
    fc.assert(
      fc.property(fc.constantFrom(...(['diabetes', 'hypertension', 'tb'] as ChronicCondition[])), (condition) => {
        const items = svc.getMonitoringChecklist(condition);
        expect(items.length).toBeGreaterThan(0);
      }),
      { numRuns: 30 },
    );
  });

  it('checklist items are always strings with content', () => {
    fc.assert(
      fc.property(fc.constantFrom(...(['diabetes', 'hypertension', 'tb'] as ChronicCondition[])), (condition) => {
        const items = svc.getMonitoringChecklist(condition);
        for (const item of items) {
          expect(typeof item).toBe('string');
          expect(item.trim().length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 30 },
    );
  });
});

// ─── Real-world scenario tests ────────────────────────────────────────────────

describe('Real-world scenarios', () => {
  it('Ramesh (diabetic farmer, Vidisha) — full enrollment flow', async () => {
    const sms = makeMockSms();
    const svc = new ChronicCareAgentService(makeMockRepo(), sms);
    const record = makeCallRecord({ callId: 'call-ramesh-001', callerNumber: '+919876500001' });

    const enrollment = await svc.enrollPatient(record, 'diabetes');

    expect(enrollment.condition).toBe('diabetes');
    expect(enrollment.icd10Code).toBe('E11.9');
    expect(enrollment.assignedAshaWorkerId).toBe('asha-001');
    // ASHA worker Sunita gets the SMS
    expect(sms.published[0].PhoneNumber).toBe('+919876543210');
    expect(sms.published[0].Message).toContain('Diabetes');
    expect(sms.published[0].Message).toContain('blood sugar');
  });

  it('Priya (TB patient, Bhopal) — daily DOT checklist', async () => {
    const sms = makeMockSms();
    const svc = new ChronicCareAgentService(makeMockRepo(), sms);
    const record = makeCallRecord({ callId: 'call-priya-001' });

    const enrollment = await svc.enrollPatient(record, 'tb');
    const checklist = svc.getFullChecklist('tb');

    expect(enrollment.icd10Code).toBe('A15.0');
    expect(checklist.frequency).toBe('daily');
    expect(checklist.items.some(i => i.includes('DOT'))).toBe(true);
    // TB alert: missed medication escalation
    expect(checklist.alertThresholds.some(t => t.toLowerCase().includes('missed'))).toBe(true);
  });

  it('Geeta (hypertensive, no ASHA in village) — enrollment succeeds, no SMS crash', async () => {
    const sms = makeMockSms();
    const svc = new ChronicCareAgentService(makeMockRepo(null), sms);
    const record = makeCallRecord({ callId: 'call-geeta-001' });

    const enrollment = await svc.enrollPatient(record, 'hypertension');

    // Enrollment is valid even without ASHA
    expect(enrollment.icd10Code).toBe('I10');
    expect(enrollment.assignedAshaWorkerId).toBe('unassigned');
    // No SMS sent — no ASHA to notify
    expect(sms.published.length).toBe(0);
  });
});


// ─── Cross-service data flow tests ────────────────────────────────────────────

describe('Cross-service ICD-10 alignment', () => {
  const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());

  it('F9: diabetes ICD-10 matches triageAgent.tagICD10("diabetes") = E11.9', async () => {
    const enrollment = await svc.enrollPatient(makeCallRecord(), 'diabetes');
    // triageAgent CONDITION_ICD10['diabetes'] = 'E11.9'
    expect(enrollment.icd10Code).toBe('E11.9');
  });

  it('F9: hypertension ICD-10 matches triageAgent.tagICD10("hypertension") = I10', async () => {
    const enrollment = await svc.enrollPatient(makeCallRecord(), 'hypertension');
    expect(enrollment.icd10Code).toBe('I10');
  });

  it('F9: tb ICD-10 matches triageAgent.tagICD10("tb") = A15.0', async () => {
    const enrollment = await svc.enrollPatient(makeCallRecord(), 'tb');
    expect(enrollment.icd10Code).toBe('A15.0');
  });
});

describe('Duplicate enrollment guard', () => {
  it('F11: same patient enrolling twice returns two separate enrollment records', async () => {
    const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    const record = makeCallRecord({ callId: 'call-dup-001' });

    const e1 = await svc.enrollPatient(record, 'diabetes');
    const e2 = await svc.enrollPatient(record, 'diabetes');

    // Both succeed — dedup is the call handler's responsibility (Task 16)
    expect(e1.patientId).toBe('call-dup-001');
    expect(e2.patientId).toBe('call-dup-001');
    // enrollmentDate differs (called at different times)
    expect(e1.enrollmentDate).toBeTruthy();
    expect(e2.enrollmentDate).toBeTruthy();
  });
});

describe('Multi-condition enrollment', () => {
  it('F12: patient with diabetes AND hypertension gets two separate enrollments', async () => {
    const sms = makeMockSms();
    const svc = new ChronicCareAgentService(makeMockRepo(), sms);
    const record = makeCallRecord({ callId: 'call-multi-001' });

    const e1 = await svc.enrollPatient(record, 'diabetes');
    const e2 = await svc.enrollPatient(record, 'hypertension');

    expect(e1.condition).toBe('diabetes');
    expect(e1.icd10Code).toBe('E11.9');
    expect(e2.condition).toBe('hypertension');
    expect(e2.icd10Code).toBe('I10');
    // Two separate SMS sent to ASHA worker
    expect(sms.published.length).toBe(2);
    expect(sms.published[0].Message).toContain('Diabetes');
    expect(sms.published[1].Message).toContain('Hypertension');
  });
});


// ─── Round 4 audit tests ──────────────────────────────────────────────────────

describe('Round 4: defensive copy and data integrity', () => {
  it('F15: getMonitoringChecklist returns a copy — mutation does not corrupt source', () => {
    const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    const items1 = svc.getMonitoringChecklist('diabetes');
    items1.push('INJECTED ITEM');
    const items2 = svc.getMonitoringChecklist('diabetes');
    // Second call must NOT contain the injected item
    expect(items2).not.toContain('INJECTED ITEM');
    expect(items2.length).toBe(5); // original 5 items
  });

  it('F15: getMonitoringChecklist returns same content each time', () => {
    const svc = new ChronicCareAgentService(makeMockRepo(), makeMockSms());
    const a = svc.getMonitoringChecklist('tb');
    const b = svc.getMonitoringChecklist('tb');
    expect(a).toEqual(b);
  });
});
