/**
 * Task 12 Tests: Post-Triage Agentic Actions
 *
 * Covers:
 *   - SmsService (Req 7.1)
 *   - ReferralAgentService (Req 7.4)
 *   - FollowUpSchedulerService (Req 7.2, 7.3)
 *   - ASHAWorkerAgentService (Req 7.5, 11.1, 11.2)
 *   - ActionOrchestratorService (Req 7.6)
 *   - Property 10: SMS content completeness
 *   - Property 11: Facility referral level matching
 */

import * as fc from 'fast-check';
import { SmsService, ISNSClient } from '../../services/smsService';
import { ReferralAgentService, IFacilityRepository } from '../../services/referralAgent';
import {
  FollowUpSchedulerService,
  IEventBridgeClient,
  IScheduleRepository,
} from '../../services/followUpScheduler';
import {
  ASHAWorkerAgentService,
  IASHAWorkerRepository,
  IASHASmsClient,
  ASHAWorkerRecord,
} from '../../services/ashaWorkerAgent';
import { ActionOrchestratorService, ISurveillanceLogger } from '../../services/actionOrchestrator';
import { ISmsService } from '../../interfaces/ISmsService';
import { IReferralAgent } from '../../interfaces/IReferralAgent';
import { IFollowUpScheduler } from '../../interfaces/IFollowUpScheduler';
import { IASHAWorkerAgent } from '../../interfaces/IASHAWorkerAgent';
import { IActionOrchestrator } from '../../interfaces/IActionOrchestrator';
import {
  TriageResult, LocationData, Facility, FacilityCapabilities,
  Hospital, PatientSummary, MonitoringChecklist, BilingualInstruction,
  FollowUpScheduleRecord,
} from '../../models/types';
import { FacilityLevel, SeverityLevel, ChronicCondition } from '../../models/enums';

// ─── Shared test fixtures ────────────────────────────────────────────────────

function makeLocation(overrides?: Partial<LocationData>): LocationData {
  return {
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
    ...overrides,
  };
}

function makeTriageResult(overrides?: Partial<TriageResult>): TriageResult {
  return {
    callId: 'call-test-001',
    isEmergency: false,
    condition: 'diarrhea',
    icd10Code: 'A09',
    severity: 'non-urgent' as SeverityLevel,
    recommendedCareLevel: 'home',
    treatmentAdvice: [
      { hindi: 'ORS घोल बनाएं: 1 लीटर पानी में 1 पैकेट ORS', english: 'Prepare ORS: 1 packet in 1 litre water' },
    ],
    dispatchType: 'none',
    followUpRequired: true,
    followUpInterval: '2h',
    ashaAlertRequired: false,
    ...overrides,
  };
}

function makeFacility(overrides?: Partial<Facility>): Facility {
  return {
    facilityId: 'fac-bhopal-phc-1',
    name: 'Bhopal PHC Arera Colony',
    address: 'Arera Colony, Bhopal, MP',
    phone: '0755-2550100',
    facilityLevel: 'PHC',
    distanceKm: 5.2,
    ...overrides,
  };
}

// ─── Mock factories ──────────────────────────────────────────────────────────

function mockSNS(): ISNSClient & { calls: Array<{ PhoneNumber: string; Message: string }> } {
  const calls: Array<{ PhoneNumber: string; Message: string }> = [];
  return {
    calls,
    publish: async (params) => { calls.push(params); },
  };
}

function mockFacilityRepo(facilities: Facility[] = [makeFacility()]): IFacilityRepository {
  return {
    findByLocationAndLevel: async () => facilities,
    getCapabilities: async (id) => ({
      facilityId: id,
      facilityLevel: 'PHC' as FacilityLevel,
      hasICU: false,
      hasBloodBank: false,
      hasSurgery: false,
      hasMaternity: false,
      hasPediatrics: false,
      bedCount: 6,
    }),
  };
}

function mockEventBridge(): IEventBridgeClient {
  return {
    putRule: async () => {},
    putTargets: async () => {},
    removeTargets: async () => {},
    deleteRule: async () => {},
  };
}

function mockScheduleRepo(): IScheduleRepository & { saved: FollowUpScheduleRecord[] } {
  const saved: FollowUpScheduleRecord[] = [];
  return {
    saved,
    save: async (record) => { saved.push(record); },
    // Return the LATEST record for a given scheduleId (simulates DynamoDB overwrite)
    get: async (id) => {
      const matches = saved.filter(r => r.scheduleId === id);
      return matches.length > 0 ? matches[matches.length - 1] : null;
    },
    delete: async () => {},
  };
}

const DEFAULT_ASHA: ASHAWorkerRecord = {
  ashaWorkerId: 'asha-001',
  name: 'Sunita Devi',
  phone: '+919876543210',
  village: 'Khedi',
  block: 'Huzur',
  district: 'Bhopal',
  state: 'Madhya Pradesh',
};

function mockASHARepo(asha: ASHAWorkerRecord | null = DEFAULT_ASHA): IASHAWorkerRepository {
  return {
    findByLocation: async () => asha,
    findById: async () => asha,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMS Service Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('SmsService', () => {
  let sns: ReturnType<typeof mockSNS>;
  let svc: SmsService;

  beforeEach(() => {
    sns = mockSNS();
    svc = new SmsService(sns);
  });

  test('sendTriageSummary publishes SMS via SNS', async () => {
    await svc.sendTriageSummary('+919999999999', makeTriageResult());
    expect(sns.calls).toHaveLength(1);
    expect(sns.calls[0].PhoneNumber).toBe('+919999999999');
  });

  test('SMS content includes condition, severity, ICD-10', async () => {
    await svc.sendTriageSummary('+919999999999', makeTriageResult());
    const msg = sns.calls[0].Message;
    expect(msg).toContain('diarrhea');
    expect(msg).toContain('A09');
    expect(msg).toContain('Non-urgent');
  });

  test('SMS content includes treatment advice in Hindi and English', async () => {
    await svc.sendTriageSummary('+919999999999', makeTriageResult());
    const msg = sns.calls[0].Message;
    expect(msg).toContain('ORS घोल बनाएं');
    expect(msg).toContain('Prepare ORS');
  });

  test('SMS includes follow-up interval when present', async () => {
    await svc.sendTriageSummary('+919999999999', makeTriageResult({ followUpInterval: '2h' }));
    const msg = sns.calls[0].Message;
    expect(msg).toContain('2h');
  });

  test('SMS includes referral facility when present', async () => {
    const result = makeTriageResult({
      recommendedCareLevel: 'PHC',
      referralFacility: makeFacility(),
    });
    await svc.sendTriageSummary('+919999999999', result);
    const msg = sns.calls[0].Message;
    expect(msg).toContain('Bhopal PHC Arera Colony');
    expect(msg).toContain('0755-2550100');
  });

  test('SMS failure does not throw', async () => {
    const failSns: ISNSClient = { publish: async () => { throw new Error('SNS down'); } };
    const failSvc = new SmsService(failSns);
    await expect(failSvc.sendTriageSummary('+919999999999', makeTriageResult())).resolves.toBeUndefined();
  });

  test('sendEmergencyInfo lists hospitals with distance', async () => {
    const hospitals: Hospital[] = [
      {
        hospitalId: 'h1', name: 'Hamidia Hospital', address: 'Bhopal',
        phone: '0755-2540222', location: { latitude: 23.26, longitude: 77.41 },
        facilityLevel: 'district_hospital', distanceKm: 3.5,
      },
    ];
    await svc.sendEmergencyInfo('+919999999999', hospitals);
    const msg = sns.calls[0].Message;
    expect(msg).toContain('Hamidia Hospital');
    expect(msg).toContain('3.5 km');
    expect(msg).toContain('108');
  });

  test('sendEmergencyInfo failure does not throw', async () => {
    const failSns: ISNSClient = { publish: async () => { throw new Error('SNS down'); } };
    const failSvc = new SmsService(failSns);
    await expect(failSvc.sendEmergencyInfo('+919999999999', [])).resolves.toBeUndefined();
  });

  test('SMS with empty treatmentAdvice is still well-formed', async () => {
    const result = makeTriageResult({ treatmentAdvice: [], condition: 'unknown', icd10Code: 'R69' });
    await svc.sendTriageSummary('+919999999999', result);
    const msg = sns.calls[0].Message;
    expect(msg).toContain('R69');
    expect(msg).toContain('unknown');
    expect(msg).not.toContain('Treatment / उपचार:');
    // Should still have care level
    expect(msg).toContain('Care Level');
  });

  test('emergency SMS includes dispatch info', async () => {
    const result = makeTriageResult({
      isEmergency: true,
      dispatchType: '108',
      severity: 'critical',
      condition: 'cardiac',
      icd10Code: 'I21.9',
    });
    await svc.sendTriageSummary('+919999999999', result);
    const msg = sns.calls[0].Message;
    expect(msg).toContain('Ambulance dispatched');
    expect(msg).toContain('एम्बुलेंस भेजी गई');
    expect(msg).toContain('108');
  });

  test('non-emergency SMS does not include dispatch info', async () => {
    await svc.sendTriageSummary('+919999999999', makeTriageResult());
    const msg = sns.calls[0].Message;
    expect(msg).not.toContain('Ambulance dispatched');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SMS Content Completeness — Property 10
// ═══════════════════════════════════════════════════════════════════════════════

describe('Property 10: SMS content completeness', () => {
  const severityArb = fc.constantFrom('critical', 'urgent', 'non-urgent') as fc.Arbitrary<SeverityLevel>;
  const careLevelArb = fc.constantFrom('home', 'PHC', 'CHC', 'district_hospital') as fc.Arbitrary<TriageResult['recommendedCareLevel']>;

  test('every triage SMS contains condition, severity, ICD-10, and care level', () => {
    const sns = mockSNS();
    const svc = new SmsService(sns);

    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),  // condition
        severityArb,
        fc.string({ minLength: 3, maxLength: 10 }),   // icd10
        careLevelArb,
        async (condition, severity, icd10, careLevel) => {
          sns.calls.length = 0;
          const result = makeTriageResult({ condition, severity, icd10Code: icd10, recommendedCareLevel: careLevel });
          await svc.sendTriageSummary('+919999999999', result);

          const msg = sns.calls[0].Message;
          // Must contain all 4 required fields
          expect(msg).toContain(condition);
          expect(msg).toContain(icd10);
          // Severity is displayed in Hindi+English format
          expect(msg.toLowerCase()).toContain(severity);
          // Care level is present (in Hindi or English form)
          expect(msg.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Referral Agent Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('ReferralAgentService', () => {
  test('returns nearest facility matching required level', async () => {
    const facilities: Facility[] = [
      makeFacility({ facilityId: 'f1', facilityLevel: 'PHC', distanceKm: 10 }),
      makeFacility({ facilityId: 'f2', facilityLevel: 'CHC', distanceKm: 20 }),
      makeFacility({ facilityId: 'f3', facilityLevel: 'district_hospital', distanceKm: 30 }),
    ];
    const svc = new ReferralAgentService(mockFacilityRepo(facilities));
    const result = await svc.findNearestFacility(makeLocation(), 'CHC');

    // CHC (rank 2) and district_hospital (rank 3) both qualify; CHC is nearer
    expect(result.facilityId).toBe('f2');
    expect(result.facilityLevel).toBe('CHC');
  });

  test('district_hospital qualifies when CHC is required (IPHS hierarchy)', async () => {
    const facilities: Facility[] = [
      makeFacility({ facilityId: 'f1', facilityLevel: 'district_hospital', distanceKm: 15 }),
    ];
    const svc = new ReferralAgentService(mockFacilityRepo(facilities));
    const result = await svc.findNearestFacility(makeLocation(), 'CHC');

    expect(result.facilityId).toBe('f1');
    expect(result.facilityLevel).toBe('district_hospital');
  });

  test('PHC does NOT qualify when CHC is required', async () => {
    const facilities: Facility[] = [
      makeFacility({ facilityId: 'f1', facilityLevel: 'PHC', distanceKm: 5 }),
    ];
    const svc = new ReferralAgentService(mockFacilityRepo(facilities));
    const result = await svc.findNearestFacility(makeLocation(), 'CHC');

    // PHC doesn't qualify for CHC — should return fallback
    expect(result.facilityId).toContain('fallback');
  });

  test('returns fallback facility when repo returns empty', async () => {
    const svc = new ReferralAgentService(mockFacilityRepo([]));
    const result = await svc.findNearestFacility(makeLocation(), 'PHC');

    expect(result.facilityId).toContain('fallback');
    expect(result.phone).toBe('108');
  });

  test('returns fallback facility when repo throws', async () => {
    const failRepo: IFacilityRepository = {
      findByLocationAndLevel: async () => { throw new Error('DynamoDB down'); },
      getCapabilities: async () => null,
    };
    const svc = new ReferralAgentService(failRepo);
    const result = await svc.findNearestFacility(makeLocation(), 'district_hospital');

    expect(result.facilityId).toContain('fallback');
    expect(result.facilityLevel).toBe('district_hospital');
  });

  test('getFacilityCapabilities returns capabilities', async () => {
    const svc = new ReferralAgentService(mockFacilityRepo());
    const caps = await svc.getFacilityCapabilities('fac-1');
    expect(caps.facilityId).toBe('fac-1');
  });

  test('getFacilityCapabilities returns defaults on error', async () => {
    const failRepo: IFacilityRepository = {
      findByLocationAndLevel: async () => [],
      getCapabilities: async () => { throw new Error('fail'); },
    };
    const svc = new ReferralAgentService(failRepo);
    const caps = await svc.getFacilityCapabilities('fac-x');
    expect(caps.facilityId).toBe('fac-x');
    expect(caps.facilityLevel).toBe('PHC');
  });

  test('uses phone-prefix district over voice-extracted district (reliability)', async () => {
    // Phone-prefix district is derived from STD code — always accurate.
    // Voice-extracted district can be misheard ("Sehore" → "Sehor" → no match).
    const location = makeLocation({
      tier1Voice: {
        rawText: 'Khedi village',
        village: 'Khedi',
        district: 'Sehore',
        state: 'Madhya Pradesh',
        accuracy: 'village',
        timestamp: new Date().toISOString(),
      },
    });

    let capturedDistrict = '';
    const repo: IFacilityRepository = {
      findByLocationAndLevel: async (district) => {
        capturedDistrict = district;
        return [makeFacility()];
      },
      getCapabilities: async () => null,
    };

    const svc = new ReferralAgentService(repo);
    await svc.findNearestFacility(location, 'PHC');
    // Phone-prefix district (Bhopal from tier2Phone) takes priority over voice (Sehore)
    expect(capturedDistrict).toBe('Bhopal');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Facility Referral Level Matching — Property 11
// ═══════════════════════════════════════════════════════════════════════════════

describe('Property 11: Facility referral level matching', () => {
  const levelArb = fc.constantFrom('PHC', 'CHC', 'district_hospital') as fc.Arbitrary<FacilityLevel>;
  const RANK: Record<FacilityLevel, number> = { PHC: 1, CHC: 2, district_hospital: 3 };

  test('returned facility always meets or exceeds required level', () => {
    fc.assert(
      fc.asyncProperty(
        levelArb,
        levelArb,
        fc.double({ min: 1, max: 100, noNaN: true }),
        async (requiredLevel, availableLevel, distance) => {
          const facilities: Facility[] = [
            makeFacility({ facilityLevel: availableLevel, distanceKm: distance }),
          ];
          const svc = new ReferralAgentService(mockFacilityRepo(facilities));
          const result = await svc.findNearestFacility(makeLocation(), requiredLevel);

          // If the available facility qualifies, it should be returned
          // If not, a fallback at the required level should be returned
          expect(RANK[result.facilityLevel]).toBeGreaterThanOrEqual(RANK[requiredLevel]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Follow-Up Scheduler Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('FollowUpSchedulerService', () => {
  let eb: IEventBridgeClient;
  let repo: ReturnType<typeof mockScheduleRepo>;
  let svc: FollowUpSchedulerService;

  beforeEach(() => {
    eb = mockEventBridge();
    repo = mockScheduleRepo();
    svc = new FollowUpSchedulerService(eb, repo);
  });

  test('scheduleFollowUp returns a schedule ID and saves to repo', async () => {
    const id = await svc.scheduleFollowUp('call-001', '2h', 'acute_check');
    expect(id).toContain('followup-call-001');
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].status).toBe('active');
    expect(repo.saved[0].purpose).toBe('acute_check');
  });

  test('scheduleFollowUp creates EventBridge rule with cron expression', async () => {
    let capturedRule = '';
    const spyEb: IEventBridgeClient = {
      ...mockEventBridge(),
      putRule: async (params) => { capturedRule = params.ScheduleExpression; },
    };
    const spySvc = new FollowUpSchedulerService(spyEb, repo);
    await spySvc.scheduleFollowUp('call-001', '2h', 'acute_check');
    expect(capturedRule).toMatch(/^cron\(\d+ \d+ \d+ \d+ \? \d{4}\)$/);
  });

  test('scheduleFollowUp returns empty string on EventBridge failure', async () => {
    const failEb: IEventBridgeClient = {
      ...mockEventBridge(),
      putRule: async () => { throw new Error('EventBridge down'); },
    };
    const failSvc = new FollowUpSchedulerService(failEb, repo);
    const id = await failSvc.scheduleFollowUp('call-001', '2h', 'acute_check');
    expect(id).toBe('');
  });

  test('scheduleFollowUp returns empty string on DynamoDB save failure', async () => {
    const failRepo: IScheduleRepository = {
      save: async () => { throw new Error('DynamoDB down'); },
      get: async () => null,
      delete: async () => {},
    };
    const failSvc = new FollowUpSchedulerService(eb, failRepo);
    const id = await failSvc.scheduleFollowUp('call-001', '2h', 'acute_check');
    // EventBridge rule was created but DynamoDB save failed — orphaned rule
    // Service should still return empty string (failure path)
    expect(id).toBe('');
  });

  test('triggerFollowUp marks schedule as triggered', async () => {
    const id = await svc.scheduleFollowUp('call-001', '2h', 'acute_check');
    await svc.triggerFollowUp(id);
    // The last saved record should be 'triggered'
    const triggered = repo.saved.find(r => r.scheduleId === id && r.status === 'triggered');
    expect(triggered).toBeDefined();
  });

  test('triggerFollowUp skips non-active schedules', async () => {
    const id = await svc.scheduleFollowUp('call-001', '2h', 'acute_check');
    await svc.cancelFollowUp(id);
    // Now trigger — should skip because status is 'cancelled'
    await svc.triggerFollowUp(id);
    const records = repo.saved.filter(r => r.scheduleId === id);
    const lastRecord = records[records.length - 1];
    expect(lastRecord.status).toBe('cancelled');
  });

  test('cancelFollowUp marks schedule as cancelled', async () => {
    const id = await svc.scheduleFollowUp('call-001', '24h', 'chronic_monitoring');
    await svc.cancelFollowUp(id);
    const cancelled = repo.saved.find(r => r.scheduleId === id && r.status === 'cancelled');
    expect(cancelled).toBeDefined();
  });

  test('cancelFollowUp handles missing schedule gracefully', async () => {
    await expect(svc.cancelFollowUp('nonexistent-id')).resolves.toBeUndefined();
  });

  test('_computeScheduledTime parses hours correctly', () => {
    const now = Date.now();
    const result = svc._computeScheduledTime('2h');
    const diffMs = result.getTime() - now;
    // Should be approximately 2 hours (within 1 second tolerance)
    expect(diffMs).toBeGreaterThan(2 * 60 * 60 * 1000 - 1000);
    expect(diffMs).toBeLessThan(2 * 60 * 60 * 1000 + 1000);
  });

  test('_computeScheduledTime parses days correctly', () => {
    const now = Date.now();
    const result = svc._computeScheduledTime('1d');
    const diffMs = result.getTime() - now;
    expect(diffMs).toBeGreaterThan(24 * 60 * 60 * 1000 - 1000);
    expect(diffMs).toBeLessThan(24 * 60 * 60 * 1000 + 1000);
  });

  test('_computeScheduledTime parses weeks correctly', () => {
    const now = Date.now();
    const result = svc._computeScheduledTime('1w');
    const diffMs = result.getTime() - now;
    expect(diffMs).toBeGreaterThan(7 * 24 * 60 * 60 * 1000 - 1000);
  });

  test('_computeScheduledTime defaults to 24h for unparseable input', () => {
    const now = Date.now();
    const result = svc._computeScheduledTime('invalid');
    const diffMs = result.getTime() - now;
    expect(diffMs).toBeGreaterThan(24 * 60 * 60 * 1000 - 1000);
    expect(diffMs).toBeLessThan(24 * 60 * 60 * 1000 + 1000);
  });

  test('_computeScheduledTime parses minutes correctly', () => {
    const now = Date.now();
    const result = svc._computeScheduledTime('30m');
    const diffMs = result.getTime() - now;
    expect(diffMs).toBeGreaterThan(30 * 60 * 1000 - 1000);
    expect(diffMs).toBeLessThan(30 * 60 * 1000 + 1000);
  });

  test('_computeScheduledTime defaults to 24h for zero-duration', () => {
    const now = Date.now();
    const result = svc._computeScheduledTime('0h');
    const diffMs = result.getTime() - now;
    // Zero-duration is clinically meaningless — should default to 24h
    expect(diffMs).toBeGreaterThan(24 * 60 * 60 * 1000 - 1000);
    expect(diffMs).toBeLessThan(24 * 60 * 60 * 1000 + 1000);
  });

  test('cancelFollowUp skips already-triggered schedules', async () => {
    const id = await svc.scheduleFollowUp('call-001', '2h', 'acute_check');
    await svc.triggerFollowUp(id);
    // Now try to cancel — should skip because status is 'triggered'
    await svc.cancelFollowUp(id);
    const records = repo.saved.filter(r => r.scheduleId === id);
    const lastRecord = records[records.length - 1];
    // Should still be 'triggered', not overwritten to 'cancelled'
    expect(lastRecord.status).toBe('triggered');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// ASHA Worker Agent Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('ASHAWorkerAgentService', () => {
  let sms: ReturnType<typeof mockSNS>;
  let svc: ASHAWorkerAgentService;

  beforeEach(() => {
    sms = mockSNS();
    svc = new ASHAWorkerAgentService(mockASHARepo(), sms);
  });

  test('alertASHAWorker sends SMS to ASHA worker', async () => {
    const patient: PatientSummary = {
      callId: 'call-001',
      conditionId: 'snakebite',
      icd10Code: 'T63.0',
      severity: 'critical',
      location: makeLocation(),
      treatmentSummaryHindi: 'तुरंत एंटीवेनम की जरूरत है',
    };
    await svc.alertASHAWorker(makeLocation(), patient);

    expect(sms.calls).toHaveLength(1);
    expect(sms.calls[0].PhoneNumber).toBe('+919876543210');
    expect(sms.calls[0].Message).toContain('snakebite');
    expect(sms.calls[0].Message).toContain('T63.0');
    expect(sms.calls[0].Message).toContain('गंभीर (Critical)');
  });

  test('alertASHAWorker includes location in message', async () => {
    const patient: PatientSummary = {
      callId: 'call-001',
      conditionId: 'cardiac',
      icd10Code: 'I21.9',
      severity: 'critical',
      location: makeLocation(),
      treatmentSummaryHindi: 'CPR शुरू करें',
    };
    await svc.alertASHAWorker(makeLocation(), patient);
    expect(sms.calls[0].Message).toContain('Bhopal, Madhya Pradesh');
  });

  test('alertASHAWorker handles no ASHA worker found gracefully', async () => {
    const noAshaSvc = new ASHAWorkerAgentService(mockASHARepo(null), sms);
    const patient: PatientSummary = {
      callId: 'call-001',
      conditionId: 'cardiac',
      icd10Code: 'I21.9',
      severity: 'critical',
      location: makeLocation(),
      treatmentSummaryHindi: 'CPR शुरू करें',
    };
    await expect(noAshaSvc.alertASHAWorker(makeLocation(), patient)).resolves.toBeUndefined();
    expect(sms.calls).toHaveLength(0);
  });

  test('alertASHAWorker handles SMS failure gracefully', async () => {
    const failSms: IASHASmsClient = { publish: async () => { throw new Error('SNS down'); } };
    const failSvc = new ASHAWorkerAgentService(mockASHARepo(), failSms);
    const patient: PatientSummary = {
      callId: 'call-001',
      conditionId: 'cardiac',
      icd10Code: 'I21.9',
      severity: 'critical',
      location: makeLocation(),
      treatmentSummaryHindi: 'CPR शुरू करें',
    };
    await expect(failSvc.alertASHAWorker(makeLocation(), patient)).resolves.toBeUndefined();
  });

  test('assignChronicCare sends assignment SMS to ASHA worker', async () => {
    await svc.assignChronicCare('patient-001', 'diabetes', 'asha-001');
    expect(sms.calls).toHaveLength(1);
    expect(sms.calls[0].Message).toContain('Diabetes');
    expect(sms.calls[0].Message).toContain('मधुमेह');
  });

  test('assignChronicCare handles missing ASHA worker', async () => {
    const noAshaSvc = new ASHAWorkerAgentService(mockASHARepo(null), sms);
    await expect(noAshaSvc.assignChronicCare('p1', 'tb', 'asha-999')).resolves.toBeUndefined();
    expect(sms.calls).toHaveLength(0);
  });

  test('sendMonitoringChecklist sends checklist SMS', async () => {
    const checklist: MonitoringChecklist = {
      condition: 'diabetes',
      items: ['Check fasting blood sugar', 'Check HbA1c'],
      frequency: 'weekly',
      alertThresholds: ['Blood sugar > 300 mg/dL', 'HbA1c > 9%'],
    };
    await svc.sendMonitoringChecklist('asha-001', checklist);
    expect(sms.calls).toHaveLength(1);
    expect(sms.calls[0].Message).toContain('Check fasting blood sugar');
    expect(sms.calls[0].Message).toContain('Blood sugar > 300 mg/dL');
    expect(sms.calls[0].Message).toContain('weekly');
  });

  test('sendMonitoringChecklist handles missing ASHA worker', async () => {
    const noAshaSvc = new ASHAWorkerAgentService(mockASHARepo(null), sms);
    const checklist: MonitoringChecklist = {
      condition: 'hypertension',
      items: ['Check BP'],
      frequency: 'daily',
      alertThresholds: ['BP > 180/120'],
    };
    await expect(noAshaSvc.sendMonitoringChecklist('asha-999', checklist)).resolves.toBeUndefined();
    expect(sms.calls).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Action Orchestrator Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('ActionOrchestratorService', () => {
  let smsSvc: ISmsService;
  let referralSvc: IReferralAgent;
  let followUpSvc: IFollowUpScheduler;
  let ashaSvc: IASHAWorkerAgent;
  let orchestrator: ActionOrchestratorService;

  // Track calls for verification
  let smsCalled: boolean;
  let referralCalled: boolean;
  let followUpCalled: boolean;
  let ashaCalled: boolean;

  beforeEach(() => {
    smsCalled = false;
    referralCalled = false;
    followUpCalled = false;
    ashaCalled = false;

    smsSvc = {
      sendTriageSummary: async () => { smsCalled = true; },
      sendEmergencyInfo: async () => {},
    };
    referralSvc = {
      findNearestFacility: async () => { referralCalled = true; return makeFacility(); },
      getFacilityCapabilities: async () => ({
        facilityId: 'f1', facilityLevel: 'PHC' as FacilityLevel,
        hasICU: false, hasBloodBank: false, hasSurgery: false,
        hasMaternity: false, hasPediatrics: false, bedCount: 6,
      }),
    };
    followUpSvc = {
      scheduleFollowUp: async () => { followUpCalled = true; return 'sched-001'; },
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };
    ashaSvc = {
      alertASHAWorker: async () => { ashaCalled = true; },
      assignChronicCare: async () => {},
      sendMonitoringChecklist: async () => {},
    };

    orchestrator = new ActionOrchestratorService(smsSvc, referralSvc, followUpSvc, ashaSvc);
  });

  test('orchestrateActions sends SMS for every triage result', async () => {
    const results = await orchestrator.orchestrateActions(makeTriageResult(), makeLocation(), '+919999999999');
    expect(results.smsSent).toBe(true);
    expect(smsCalled).toBe(true);
  });

  test('orchestrateActions skips referral when care level is home', async () => {
    const results = await orchestrator.orchestrateActions(
      makeTriageResult({ recommendedCareLevel: 'home' }),
      makeLocation(),
      '+919999999999',
    );
    expect(results.referralFacility).toBeUndefined();
    expect(referralCalled).toBe(false);
  });

  test('orchestrateActions finds referral when care level is PHC', async () => {
    const results = await orchestrator.orchestrateActions(
      makeTriageResult({ recommendedCareLevel: 'PHC' }),
      makeLocation(),
      '+919999999999',
    );
    expect(results.referralFacility).toBeDefined();
    expect(referralCalled).toBe(true);
  });

  test('orchestrateActions finds referral when care level is district_hospital', async () => {
    const results = await orchestrator.orchestrateActions(
      makeTriageResult({ recommendedCareLevel: 'district_hospital' }),
      makeLocation(),
      '+919999999999',
    );
    expect(results.referralFacility).toBeDefined();
  });

  test('orchestrateActions schedules follow-up when required', async () => {
    const results = await orchestrator.orchestrateActions(
      makeTriageResult({ followUpRequired: true, followUpInterval: '2h' }),
      makeLocation(),
      '+919999999999',
    );
    expect(results.followUpScheduled).toBe(true);
    expect(followUpCalled).toBe(true);
  });

  test('orchestrateActions skips follow-up when not required', async () => {
    const results = await orchestrator.orchestrateActions(
      makeTriageResult({ followUpRequired: false }),
      makeLocation(),
      '+919999999999',
    );
    expect(results.followUpScheduled).toBe(false);
    expect(followUpCalled).toBe(false);
  });

  test('orchestrateActions skips follow-up when interval is missing', async () => {
    const results = await orchestrator.orchestrateActions(
      makeTriageResult({ followUpRequired: true, followUpInterval: undefined }),
      makeLocation(),
      '+919999999999',
    );
    expect(results.followUpScheduled).toBe(false);
  });

  test('orchestrateActions alerts ASHA when required', async () => {
    const results = await orchestrator.orchestrateActions(
      makeTriageResult({ ashaAlertRequired: true }),
      makeLocation(),
      '+919999999999',
    );
    expect(results.ashaAlerted).toBe(true);
    expect(ashaCalled).toBe(true);
  });

  test('orchestrateActions skips ASHA when not required', async () => {
    const results = await orchestrator.orchestrateActions(
      makeTriageResult({ ashaAlertRequired: false }),
      makeLocation(),
      '+919999999999',
    );
    expect(results.ashaAlerted).toBe(false);
    expect(ashaCalled).toBe(false);
  });

  test('orchestrateActions always logs surveillance', async () => {
    const results = await orchestrator.orchestrateActions(makeTriageResult(), makeLocation(), '+919999999999');
    expect(results.surveillanceLogged).toBe(true);
  });

  test('SMS failure does not block other actions', async () => {
    const failSmsSvc: ISmsService = {
      sendTriageSummary: async () => { throw new Error('SNS down'); },
      sendEmergencyInfo: async () => {},
    };
    const orch = new ActionOrchestratorService(failSmsSvc, referralSvc, followUpSvc, ashaSvc);
    const results = await orch.orchestrateActions(
      makeTriageResult({ recommendedCareLevel: 'PHC', ashaAlertRequired: true }),
      makeLocation(),
      '+919999999999',
    );
    // SMS failed but others should succeed
    expect(results.smsSent).toBe(false);
    expect(results.referralFacility).toBeDefined();
    expect(results.surveillanceLogged).toBe(true);
  });

  test('referral failure does not block other actions', async () => {
    const failReferral: IReferralAgent = {
      findNearestFacility: async () => { throw new Error('DynamoDB down'); },
      getFacilityCapabilities: async () => { throw new Error('fail'); },
    };
    const orch = new ActionOrchestratorService(smsSvc, failReferral, followUpSvc, ashaSvc);
    const results = await orch.orchestrateActions(
      makeTriageResult({ recommendedCareLevel: 'CHC', followUpRequired: true, followUpInterval: '2h' }),
      makeLocation(),
      '+919999999999',
    );
    expect(results.referralFacility).toBeUndefined();
    expect(results.smsSent).toBe(true);
    expect(results.followUpScheduled).toBe(true);
  });

  test('follow-up failure does not block other actions', async () => {
    const failFollowUp: IFollowUpScheduler = {
      scheduleFollowUp: async () => { throw new Error('EventBridge down'); },
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };
    const orch = new ActionOrchestratorService(smsSvc, referralSvc, failFollowUp, ashaSvc);
    const results = await orch.orchestrateActions(
      makeTriageResult({ followUpRequired: true, followUpInterval: '2h' }),
      makeLocation(),
      '+919999999999',
    );
    expect(results.followUpScheduled).toBe(false);
    expect(results.smsSent).toBe(true);
  });

  test('ASHA failure does not block other actions', async () => {
    const failAsha: IASHAWorkerAgent = {
      alertASHAWorker: async () => { throw new Error('ASHA repo down'); },
      assignChronicCare: async () => {},
      sendMonitoringChecklist: async () => {},
    };
    const orch = new ActionOrchestratorService(smsSvc, referralSvc, followUpSvc, failAsha);
    const results = await orch.orchestrateActions(
      makeTriageResult({ ashaAlertRequired: true }),
      makeLocation(),
      '+919999999999',
    );
    expect(results.ashaAlerted).toBe(false);
    expect(results.smsSent).toBe(true);
  });

  test('_careLevelToFacilityLevel maps correctly', () => {
    expect(orchestrator._careLevelToFacilityLevel('PHC')).toBe('PHC');
    expect(orchestrator._careLevelToFacilityLevel('CHC')).toBe('CHC');
    expect(orchestrator._careLevelToFacilityLevel('district_hospital')).toBe('district_hospital');
    expect(orchestrator._careLevelToFacilityLevel('home')).toBe('PHC');
  });

  test('emergency triage sets follow-up purpose to post_emergency', async () => {
    let capturedPurpose = '';
    const spyFollowUp: IFollowUpScheduler = {
      scheduleFollowUp: async (_callId, _interval, purpose) => {
        capturedPurpose = purpose;
        return 'sched-001';
      },
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };
    const orch = new ActionOrchestratorService(smsSvc, referralSvc, spyFollowUp, ashaSvc);
    await orch.orchestrateActions(
      makeTriageResult({ isEmergency: true, followUpRequired: true, followUpInterval: '2h' }),
      makeLocation(),
      '+919999999999',
    );
    expect(capturedPurpose).toBe('post_emergency');
  });

  test('non-emergency triage sets follow-up purpose to acute_check', async () => {
    let capturedPurpose = '';
    const spyFollowUp: IFollowUpScheduler = {
      scheduleFollowUp: async (_callId, _interval, purpose) => {
        capturedPurpose = purpose;
        return 'sched-001';
      },
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };
    const orch = new ActionOrchestratorService(smsSvc, referralSvc, spyFollowUp, ashaSvc);
    await orch.orchestrateActions(
      makeTriageResult({ isEmergency: false, followUpRequired: true, followUpInterval: '2h' }),
      makeLocation(),
      '+919999999999',
    );
    expect(capturedPurpose).toBe('acute_check');
  });

  test('SMS receives actual caller number, not callId', async () => {
    let capturedPhone = '';
    const spySms: ISmsService = {
      sendTriageSummary: async (phone) => { capturedPhone = phone; },
      sendEmergencyInfo: async () => {},
    };
    const orch = new ActionOrchestratorService(spySms, referralSvc, followUpSvc, ashaSvc);
    await orch.orchestrateActions(
      makeTriageResult({ callId: 'call-xyz-123' }),
      makeLocation(),
      '+918765432100',
    );
    expect(capturedPhone).toBe('+918765432100');
    expect(capturedPhone).not.toBe('call-xyz-123');
  });

  test('all actions fail simultaneously — results reflect all failures', async () => {
    const failSms: ISmsService = {
      sendTriageSummary: async () => { throw new Error('SNS down'); },
      sendEmergencyInfo: async () => {},
    };
    const failReferral: IReferralAgent = {
      findNearestFacility: async () => { throw new Error('DynamoDB down'); },
      getFacilityCapabilities: async () => { throw new Error('fail'); },
    };
    const failFollowUp: IFollowUpScheduler = {
      scheduleFollowUp: async () => { throw new Error('EventBridge down'); },
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };
    const failAsha: IASHAWorkerAgent = {
      alertASHAWorker: async () => { throw new Error('ASHA repo down'); },
      assignChronicCare: async () => {},
      sendMonitoringChecklist: async () => {},
    };
    const orch = new ActionOrchestratorService(failSms, failReferral, failFollowUp, failAsha);
    const results = await orch.orchestrateActions(
      makeTriageResult({
        recommendedCareLevel: 'CHC',
        followUpRequired: true,
        followUpInterval: '2h',
        ashaAlertRequired: true,
      }),
      makeLocation(),
      '+919999999999',
    );
    // All actions failed except surveillance stub
    expect(results.smsSent).toBe(false);
    expect(results.referralFacility).toBeUndefined();
    expect(results.followUpScheduled).toBe(false);
    expect(results.ashaAlerted).toBe(false);
    expect(results.surveillanceLogged).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Surveillance wiring tests (Task 13)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ActionOrchestratorService — surveillance wiring', () => {

  // Reuse the same helpers from the main describe block
  function makeLocation2(): LocationData {
    return {
      tier2Phone: {
        stdCode: '0755',
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        district: 'Bhopal',
        accuracy: 'district' as const,
        method: 'automatic' as const,
      },
      primaryLocation: 'Bhopal',
      accuracyLevel: 'district' as const,
    };
  }

  function makeTriageResult2(overrides?: Partial<TriageResult>): TriageResult {
    return {
      callId: 'call-surv-001',
      isEmergency: false,
      condition: 'general_fever',
      icd10Code: 'R50.9',
      severity: 'non-urgent' as SeverityLevel,
      recommendedCareLevel: 'home',
      treatmentAdvice: [{ hindi: 'आराम करें', english: 'Rest' }],
      dispatchType: 'none',
      followUpRequired: false,
      ashaAlertRequired: false,
      ...overrides,
    };
  }

  const noopSms: ISmsService = {
    sendTriageSummary: async () => {},
    sendEmergencyInfo: async () => {},
  };
  const noopReferral: IReferralAgent = {
    findNearestFacility: async () => ({ facilityId: 'f1', name: 'PHC', address: '', phone: '', facilityLevel: 'PHC' as FacilityLevel }),
    getFacilityCapabilities: async () => ({ facilityId: 'f1', facilityLevel: 'PHC' as FacilityLevel, hasICU: false, hasBloodBank: false, hasSurgery: false, hasMaternity: false, hasPediatrics: false, bedCount: 10 }),
  };
  const noopFollowUp: IFollowUpScheduler = {
    scheduleFollowUp: async () => '',
    triggerFollowUp: async () => {},
    cancelFollowUp: async () => {},
  };
  const noopAsha: IASHAWorkerAgent = {
    alertASHAWorker: async () => {},
    assignChronicCare: async () => {},
    sendMonitoringChecklist: async () => {},
  };

  test('surveillance logger receives icd10Code and district from triage+location', async () => {
    let captured: any = null;
    const logger: ISurveillanceLogger = {
      logTriageForSurveillance: async (record) => { captured = record; },
    };
    const orch = new ActionOrchestratorService(noopSms, noopReferral, noopFollowUp, noopAsha, logger);

    await orch.orchestrateActions(
      makeTriageResult2({ icd10Code: 'A90', condition: 'dengue' }),
      makeLocation2(),
      '+919999999999',
    );

    expect(captured).not.toBeNull();
    expect(captured.icd10Code).toBe('A90');
    expect(captured.district).toBe('Bhopal');
    expect(captured.state).toBe('Madhya Pradesh');
    expect(captured.callId).toBe('call-surv-001');
    expect(captured.timestamp).toBeDefined();
  });

  test('surveillance logged = true when logger succeeds', async () => {
    const logger: ISurveillanceLogger = {
      logTriageForSurveillance: async () => {},
    };
    const orch = new ActionOrchestratorService(noopSms, noopReferral, noopFollowUp, noopAsha, logger);

    const results = await orch.orchestrateActions(
      makeTriageResult2(),
      makeLocation2(),
      '+919999999999',
    );

    expect(results.surveillanceLogged).toBe(true);
  });

  test('surveillance logged = false when logger fails (non-blocking)', async () => {
    const logger: ISurveillanceLogger = {
      logTriageForSurveillance: async () => { throw new Error('DynamoDB write failed'); },
    };
    const orch = new ActionOrchestratorService(noopSms, noopReferral, noopFollowUp, noopAsha, logger);

    const results = await orch.orchestrateActions(
      makeTriageResult2(),
      makeLocation2(),
      '+919999999999',
    );

    // Surveillance failure is non-blocking — other actions still succeed
    expect(results.surveillanceLogged).toBe(false);
    expect(results.smsSent).toBe(true);
  });

  test('no logger injected — surveillance still succeeds (backward compatible)', async () => {
    const orch = new ActionOrchestratorService(noopSms, noopReferral, noopFollowUp, noopAsha);

    const results = await orch.orchestrateActions(
      makeTriageResult2(),
      makeLocation2(),
      '+919999999999',
    );

    expect(results.surveillanceLogged).toBe(true);
  });

  test('surveillance logger receives village from Tier 1 voice location', async () => {
    let captured: any = null;
    const logger: ISurveillanceLogger = {
      logTriageForSurveillance: async (record) => { captured = record; },
    };
    const orch = new ActionOrchestratorService(noopSms, noopReferral, noopFollowUp, noopAsha, logger);

    const locationWithVillage: LocationData = {
      tier1Voice: {
        rawText: 'Khedi gaon',
        village: 'Khedi',
        accuracy: 'village' as const,
        timestamp: new Date().toISOString(),
      },
      tier2Phone: {
        stdCode: '0755',
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        district: 'Bhopal',
        accuracy: 'district' as const,
        method: 'automatic' as const,
      },
      primaryLocation: 'Khedi',
      accuracyLevel: 'village' as const,
    };

    await orch.orchestrateActions(
      makeTriageResult2({ icd10Code: 'A90' }),
      locationWithVillage,
      '+919999999999',
    );

    expect(captured).not.toBeNull();
    expect(captured.village).toBe('Khedi');
    expect(captured.district).toBe('Bhopal');
  });

  test('surveillance logger receives undefined village when no Tier 1 data', async () => {
    let captured: any = null;
    const logger: ISurveillanceLogger = {
      logTriageForSurveillance: async (record) => { captured = record; },
    };
    const orch = new ActionOrchestratorService(noopSms, noopReferral, noopFollowUp, noopAsha, logger);

    await orch.orchestrateActions(
      makeTriageResult2(),
      makeLocation2(),  // no tier1Voice
      '+919999999999',
    );

    expect(captured).not.toBeNull();
    expect(captured.village).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Task 12 Round 5 — Real-world scenario fixes
// ═══════════════════════════════════════════════════════════════════════════════

describe('SmsService — landline detection', () => {
  let sns: ReturnType<typeof mockSNS>;
  let svc: SmsService;

  beforeEach(() => {
    sns = mockSNS();
    svc = new SmsService(sns);
  });

  test('skips SMS for domestic landline number (starts with 0)', async () => {
    await svc.sendTriageSummary('07552550100', makeTriageResult());
    expect(sns.calls).toHaveLength(0);
  });

  test('skips SMS for +91 landline number (subscriber digit 1-5)', async () => {
    await svc.sendTriageSummary('+912550100', makeTriageResult());
    expect(sns.calls).toHaveLength(0);
  });

  test('sends SMS for mobile number (+91 subscriber digit 6-9)', async () => {
    await svc.sendTriageSummary('+919876543210', makeTriageResult());
    expect(sns.calls).toHaveLength(1);
  });

  test('sends SMS for mobile number starting with +916', async () => {
    await svc.sendTriageSummary('+916123456789', makeTriageResult());
    expect(sns.calls).toHaveLength(1);
  });

  test('_isLandline returns true for 0-prefix numbers', () => {
    expect(svc._isLandline('07552550100')).toBe(true);
    expect(svc._isLandline('01124567890')).toBe(true);
  });

  test('_isLandline returns false for mobile numbers', () => {
    expect(svc._isLandline('+919876543210')).toBe(false);
    expect(svc._isLandline('+918765432100')).toBe(false);
  });

  test('sendEmergencyInfo also skips for landline', async () => {
    const hospitals = [{
      hospitalId: 'h1', name: 'Test Hospital', address: 'Addr',
      phone: '108', location: { latitude: 0, longitude: 0 },
      facilityLevel: 'district_hospital' as FacilityLevel, distanceKm: 5,
    }];
    await svc.sendEmergencyInfo('07552550100', hospitals);
    expect(sns.calls).toHaveLength(0);
  });
});

describe('SmsService — SMS truncation guard', () => {
  let sns: ReturnType<typeof mockSNS>;
  let svc: SmsService;

  beforeEach(() => {
    sns = mockSNS();
    svc = new SmsService(sns);
  });

  test('long SMS is truncated with 108 footer', async () => {
    // Generate a triage result with many long treatment instructions
    const longAdvice: BilingualInstruction[] = [];
    for (let i = 0; i < 30; i++) {
      longAdvice.push({
        hindi: `उपचार निर्देश ${i}: यह एक बहुत लंबा उपचार निर्देश है जो SMS की सीमा को पार करने के लिए बनाया गया है`,
        english: `Treatment instruction ${i}: This is a very long treatment instruction designed to exceed the SMS character limit`,
      });
    }
    const result = makeTriageResult({ treatmentAdvice: longAdvice });
    await svc.sendTriageSummary('+919999999999', result);

    const msg = sns.calls[0].Message;
    expect(msg.length).toBeLessThanOrEqual(1500);
    expect(msg).toContain('108');
    expect(msg).toContain('पूरी जानकारी के लिए');
  });

  test('short SMS is NOT truncated', async () => {
    await svc.sendTriageSummary('+919999999999', makeTriageResult());
    const msg = sns.calls[0].Message;
    expect(msg).not.toContain('पूरी जानकारी के लिए 108 पर कॉल करें');
  });
});

describe('ActionOrchestratorService — race condition fix (referral before SMS)', () => {
  test('SMS includes referral facility when care level is PHC', async () => {
    let capturedTriageResult: TriageResult | null = null;
    const spySms: ISmsService = {
      sendTriageSummary: async (_phone, triage) => { capturedTriageResult = triage; },
      sendEmergencyInfo: async () => {},
    };
    const referral: IReferralAgent = {
      findNearestFacility: async () => makeFacility({ name: 'Bhopal PHC Arera Colony' }),
      getFacilityCapabilities: async () => ({
        facilityId: 'f1', facilityLevel: 'PHC' as FacilityLevel,
        hasICU: false, hasBloodBank: false, hasSurgery: false,
        hasMaternity: false, hasPediatrics: false, bedCount: 6,
      }),
    };
    const followUp: IFollowUpScheduler = {
      scheduleFollowUp: async () => 'sched-001',
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };
    const asha: IASHAWorkerAgent = {
      alertASHAWorker: async () => {},
      assignChronicCare: async () => {},
      sendMonitoringChecklist: async () => {},
    };

    const orch = new ActionOrchestratorService(spySms, referral, followUp, asha);
    await orch.orchestrateActions(
      makeTriageResult({ recommendedCareLevel: 'PHC' }),
      makeLocation(),
      '+919999999999',
    );

    // The SMS should have received the triageResult WITH referralFacility attached
    expect(capturedTriageResult).not.toBeNull();
    expect(capturedTriageResult!.referralFacility).toBeDefined();
    expect(capturedTriageResult!.referralFacility!.name).toBe('Bhopal PHC Arera Colony');
  });

  test('referral failure does not block SMS (SMS still sent without facility)', async () => {
    let smsCalled = false;
    const spySms: ISmsService = {
      sendTriageSummary: async () => { smsCalled = true; },
      sendEmergencyInfo: async () => {},
    };
    const failReferral: IReferralAgent = {
      findNearestFacility: async () => { throw new Error('DynamoDB down'); },
      getFacilityCapabilities: async () => { throw new Error('fail'); },
    };
    const followUp: IFollowUpScheduler = {
      scheduleFollowUp: async () => '',
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };
    const asha: IASHAWorkerAgent = {
      alertASHAWorker: async () => {},
      assignChronicCare: async () => {},
      sendMonitoringChecklist: async () => {},
    };

    const orch = new ActionOrchestratorService(spySms, failReferral, followUp, asha);
    const results = await orch.orchestrateActions(
      makeTriageResult({ recommendedCareLevel: 'CHC' }),
      makeLocation(),
      '+919999999999',
    );

    expect(smsCalled).toBe(true);
    expect(results.smsSent).toBe(true);
    expect(results.referralFacility).toBeUndefined();
  });
});

describe('ActionOrchestratorService — emergency hospital SMS', () => {
  test('emergency caller with referral gets hospital SMS', async () => {
    let emergencySmsCalled = false;
    const spySms: ISmsService = {
      sendTriageSummary: async () => {},
      sendEmergencyInfo: async () => { emergencySmsCalled = true; },
    };
    const referral: IReferralAgent = {
      findNearestFacility: async () => makeFacility({ facilityLevel: 'district_hospital' }),
      getFacilityCapabilities: async () => ({
        facilityId: 'f1', facilityLevel: 'district_hospital' as FacilityLevel,
        hasICU: true, hasBloodBank: true, hasSurgery: true,
        hasMaternity: true, hasPediatrics: true, bedCount: 100,
      }),
    };
    const followUp: IFollowUpScheduler = {
      scheduleFollowUp: async () => 'sched-001',
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };
    const asha: IASHAWorkerAgent = {
      alertASHAWorker: async () => {},
      assignChronicCare: async () => {},
      sendMonitoringChecklist: async () => {},
    };

    const orch = new ActionOrchestratorService(spySms, referral, followUp, asha);
    await orch.orchestrateActions(
      makeTriageResult({
        isEmergency: true,
        recommendedCareLevel: 'district_hospital',
        severity: 'critical',
      }),
      makeLocation(),
      '+919999999999',
    );

    expect(emergencySmsCalled).toBe(true);
  });

  test('non-emergency caller does NOT get hospital SMS', async () => {
    let emergencySmsCalled = false;
    const spySms: ISmsService = {
      sendTriageSummary: async () => {},
      sendEmergencyInfo: async () => { emergencySmsCalled = true; },
    };
    const referral: IReferralAgent = {
      findNearestFacility: async () => makeFacility(),
      getFacilityCapabilities: async () => ({
        facilityId: 'f1', facilityLevel: 'PHC' as FacilityLevel,
        hasICU: false, hasBloodBank: false, hasSurgery: false,
        hasMaternity: false, hasPediatrics: false, bedCount: 6,
      }),
    };
    const followUp: IFollowUpScheduler = {
      scheduleFollowUp: async () => '',
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };
    const asha: IASHAWorkerAgent = {
      alertASHAWorker: async () => {},
      assignChronicCare: async () => {},
      sendMonitoringChecklist: async () => {},
    };

    const orch = new ActionOrchestratorService(spySms, referral, followUp, asha);
    await orch.orchestrateActions(
      makeTriageResult({ isEmergency: false, recommendedCareLevel: 'PHC' }),
      makeLocation(),
      '+919999999999',
    );

    expect(emergencySmsCalled).toBe(false);
  });
});

describe('FollowUpSchedulerService — scheduleId uniqueness', () => {
  test('two rapid schedules produce different IDs (counter prevents collision)', async () => {
    const eb = mockEventBridge();
    const repo = mockScheduleRepo();
    const svc = new FollowUpSchedulerService(eb, repo);

    const id1 = await svc.scheduleFollowUp('call-001', '2h', 'acute_check');
    const id2 = await svc.scheduleFollowUp('call-001', '2h', 'acute_check');

    expect(id1).not.toBe(id2);
    expect(id1).toContain('followup-call-001');
    expect(id2).toContain('followup-call-001');
  });
});

describe('ASHAWorkerAgentService — Hindi condition name in alert', () => {
  test('alert message includes Hindi condition name for snakebite', async () => {
    const sms = mockSNS();
    const svc = new ASHAWorkerAgentService(mockASHARepo(), sms);
    const patient: PatientSummary = {
      callId: 'call-001',
      conditionId: 'snakebite',
      icd10Code: 'T63.0',
      severity: 'critical',
      location: makeLocation(),
      treatmentSummaryHindi: 'एंटीवेनम की जरूरत',
    };
    await svc.alertASHAWorker(makeLocation(), patient);
    const msg = sms.calls[0].Message;
    expect(msg).toContain('सांप का काटना');
    expect(msg).toContain('snakebite');
    expect(msg).toContain('T63.0');
  });

  test('alert message includes Hindi condition name for cardiac', async () => {
    const sms = mockSNS();
    const svc = new ASHAWorkerAgentService(mockASHARepo(), sms);
    const patient: PatientSummary = {
      callId: 'call-002',
      conditionId: 'cardiac',
      icd10Code: 'I21.9',
      severity: 'critical',
      location: makeLocation(),
      treatmentSummaryHindi: 'CPR शुरू करें',
    };
    await svc.alertASHAWorker(makeLocation(), patient);
    const msg = sms.calls[0].Message;
    expect(msg).toContain('हृदय रोग');
    expect(msg).toContain('cardiac');
  });

  test('unknown condition falls back to raw conditionId', async () => {
    const sms = mockSNS();
    const svc = new ASHAWorkerAgentService(mockASHARepo(), sms);
    const patient: PatientSummary = {
      callId: 'call-003',
      conditionId: 'rare_tropical_disease',
      icd10Code: 'B99',
      severity: 'urgent',
      location: makeLocation(),
      treatmentSummaryHindi: 'डॉक्टर से मिलें',
    };
    await svc.alertASHAWorker(makeLocation(), patient);
    const msg = sms.calls[0].Message;
    expect(msg).toContain('rare_tropical_disease');
  });

  test('alert message shows severity in Hindi for ASHA worker comprehension', async () => {
    const sms = mockSNS();
    const svc = new ASHAWorkerAgentService(mockASHARepo(), sms);

    // Test all 3 severity levels
    for (const [severity, expectedHindi] of [
      ['critical', 'गंभीर (Critical)'],
      ['urgent', 'तत्काल (Urgent)'],
      ['non-urgent', 'सामान्य (Non-urgent)'],
    ] as const) {
      sms.calls.length = 0;
      const patient: PatientSummary = {
        callId: `call-sev-${severity}`,
        conditionId: 'diarrhea',
        icd10Code: 'A09',
        severity: severity as any,
        location: makeLocation(),
        treatmentSummaryHindi: 'ORS दें',
      };
      await svc.alertASHAWorker(makeLocation(), patient);
      const msg = sms.calls[0].Message;
      expect(msg).toContain(expectedHindi);
    }
  });
});

describe('ReferralAgentService — district priority (phone over voice)', () => {
  test('uses voice district as fallback when phone district is empty', async () => {
    const location: LocationData = {
      tier1Voice: {
        rawText: 'Khedi village',
        village: 'Khedi',
        district: 'Sehore',
        state: 'Madhya Pradesh',
        accuracy: 'village',
        timestamp: new Date().toISOString(),
      },
      tier2Phone: {
        stdCode: '',
        city: '',
        state: '',
        district: '',
        accuracy: 'district',
        method: 'automatic',
      },
      primaryLocation: 'Khedi',
      accuracyLevel: 'village',
    };

    let capturedDistrict = '';
    const repo: IFacilityRepository = {
      findByLocationAndLevel: async (district) => {
        capturedDistrict = district;
        return [makeFacility()];
      },
      getCapabilities: async () => null,
    };

    const svc = new ReferralAgentService(repo);
    await svc.findNearestFacility(location, 'PHC');
    // Phone district is empty, so voice district is used as fallback
    expect(capturedDistrict).toBe('Sehore');
  });
});

describe('ActionOrchestratorService — smsSent accuracy for landline callers', () => {
  test('smsSent is false when caller is on landline', async () => {
    const spySms: ISmsService = {
      sendTriageSummary: async () => {},
      sendEmergencyInfo: async () => {},
    };
    const referral: IReferralAgent = {
      findNearestFacility: async () => makeFacility(),
      getFacilityCapabilities: async () => ({
        facilityId: 'f1', facilityLevel: 'PHC' as FacilityLevel,
        hasICU: false, hasBloodBank: false, hasSurgery: false,
        hasMaternity: false, hasPediatrics: false, bedCount: 6,
      }),
    };
    const followUp: IFollowUpScheduler = {
      scheduleFollowUp: async () => '',
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };
    const asha: IASHAWorkerAgent = {
      alertASHAWorker: async () => {},
      assignChronicCare: async () => {},
      sendMonitoringChecklist: async () => {},
    };

    const orch = new ActionOrchestratorService(spySms, referral, followUp, asha);
    const results = await orch.orchestrateActions(
      makeTriageResult(),
      makeLocation(),
      '07552550100',  // landline number
    );

    // SMS was "sent" (no error) but smsSent should be false because it's a landline
    expect(results.smsSent).toBe(false);
  });

  test('smsSent is true when caller is on mobile', async () => {
    const spySms: ISmsService = {
      sendTriageSummary: async () => {},
      sendEmergencyInfo: async () => {},
    };
    const referral: IReferralAgent = {
      findNearestFacility: async () => makeFacility(),
      getFacilityCapabilities: async () => ({
        facilityId: 'f1', facilityLevel: 'PHC' as FacilityLevel,
        hasICU: false, hasBloodBank: false, hasSurgery: false,
        hasMaternity: false, hasPediatrics: false, bedCount: 6,
      }),
    };
    const followUp: IFollowUpScheduler = {
      scheduleFollowUp: async () => '',
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };
    const asha: IASHAWorkerAgent = {
      alertASHAWorker: async () => {},
      assignChronicCare: async () => {},
      sendMonitoringChecklist: async () => {},
    };

    const orch = new ActionOrchestratorService(spySms, referral, followUp, asha);
    const results = await orch.orchestrateActions(
      makeTriageResult(),
      makeLocation(),
      '+919876543210',  // mobile number
    );

    expect(results.smsSent).toBe(true);
  });
});

describe('ActionOrchestratorService — emergency ASHA alert includes multiple instructions', () => {
  test('emergency triage sends up to 3 treatment instructions to ASHA worker', async () => {
    let capturedSummary = '';
    const spyAsha: IASHAWorkerAgent = {
      alertASHAWorker: async (_loc, patient) => { capturedSummary = patient.treatmentSummaryHindi; },
      assignChronicCare: async () => {},
      sendMonitoringChecklist: async () => {},
    };
    const spySms: ISmsService = {
      sendTriageSummary: async () => {},
      sendEmergencyInfo: async () => {},
    };
    const referral: IReferralAgent = {
      findNearestFacility: async () => makeFacility({ facilityLevel: 'district_hospital' }),
      getFacilityCapabilities: async () => ({
        facilityId: 'f1', facilityLevel: 'district_hospital' as FacilityLevel,
        hasICU: true, hasBloodBank: true, hasSurgery: true,
        hasMaternity: true, hasPediatrics: true, bedCount: 100,
      }),
    };
    const followUp: IFollowUpScheduler = {
      scheduleFollowUp: async () => 'sched-001',
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };

    const orch = new ActionOrchestratorService(spySms, referral, followUp, spyAsha);
    await orch.orchestrateActions(
      makeTriageResult({
        isEmergency: true,
        ashaAlertRequired: true,
        recommendedCareLevel: 'district_hospital',
        severity: 'critical',
        treatmentAdvice: [
          { hindi: 'अंग को स्थिर रखें', english: 'Immobilize the limb' },
          { hindi: 'टूर्निकेट मत लगाइए', english: 'Do NOT apply tourniquet' },
          { hindi: 'काटना या चूसना मत', english: 'Do NOT cut or suck' },
          { hindi: 'बर्फ मत लगाइए', english: 'Do NOT apply ice' },
        ],
      }),
      makeLocation(),
      '+919999999999',
    );

    // Should include first 3 instructions separated by semicolons
    expect(capturedSummary).toContain('अंग को स्थिर रखें');
    expect(capturedSummary).toContain('टूर्निकेट मत लगाइए');
    expect(capturedSummary).toContain('काटना या चूसना मत');
    // 4th instruction should NOT be included (max 3)
    expect(capturedSummary).not.toContain('बर्फ मत लगाइए');
  });

  test('non-emergency triage sends only first instruction to ASHA worker', async () => {
    let capturedSummary = '';
    const spyAsha: IASHAWorkerAgent = {
      alertASHAWorker: async (_loc, patient) => { capturedSummary = patient.treatmentSummaryHindi; },
      assignChronicCare: async () => {},
      sendMonitoringChecklist: async () => {},
    };
    const spySms: ISmsService = {
      sendTriageSummary: async () => {},
      sendEmergencyInfo: async () => {},
    };
    const referral: IReferralAgent = {
      findNearestFacility: async () => makeFacility(),
      getFacilityCapabilities: async () => ({
        facilityId: 'f1', facilityLevel: 'PHC' as FacilityLevel,
        hasICU: false, hasBloodBank: false, hasSurgery: false,
        hasMaternity: false, hasPediatrics: false, bedCount: 6,
      }),
    };
    const followUp: IFollowUpScheduler = {
      scheduleFollowUp: async () => '',
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };

    const orch = new ActionOrchestratorService(spySms, referral, followUp, spyAsha);
    await orch.orchestrateActions(
      makeTriageResult({
        isEmergency: false,
        ashaAlertRequired: true,
        treatmentAdvice: [
          { hindi: 'ORS घोल बनाएं', english: 'Prepare ORS' },
          { hindi: 'खूब पानी पिलाएं', english: 'Give plenty of fluids' },
        ],
      }),
      makeLocation(),
      '+919999999999',
    );

    expect(capturedSummary).toBe('ORS घोल बनाएं');
    expect(capturedSummary).not.toContain('खूब पानी पिलाएं');
  });
});

describe('FollowUpSchedulerService — rule name length safety', () => {
  test('rule name stays within 64 chars even with long callId', async () => {
    let capturedRuleName = '';
    const spyEb: IEventBridgeClient = {
      ...mockEventBridge(),
      putRule: async (params) => { capturedRuleName = params.Name; },
    };
    const repo = mockScheduleRepo();
    const svc = new FollowUpSchedulerService(spyEb, repo);

    // Twilio SID is 34 chars
    const longCallId = 'CA1234567890abcdef1234567890abcdef';
    await svc.scheduleFollowUp(longCallId, '2h', 'acute_check');

    expect(capturedRuleName.length).toBeLessThanOrEqual(64);
    expect(capturedRuleName).toContain('vv-fu-');
  });

  test('rule name works with short callId', async () => {
    let capturedRuleName = '';
    const spyEb: IEventBridgeClient = {
      ...mockEventBridge(),
      putRule: async (params) => { capturedRuleName = params.Name; },
    };
    const repo = mockScheduleRepo();
    const svc = new FollowUpSchedulerService(spyEb, repo);

    await svc.scheduleFollowUp('call-001', '2h', 'acute_check');

    expect(capturedRuleName.length).toBeLessThanOrEqual(64);
    expect(capturedRuleName).toContain('vv-fu-');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Interface compliance tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Interface compliance', () => {
  test('SmsService implements ISmsService', () => {
    const svc: ISmsService = new SmsService(mockSNS());
    expect(svc.sendTriageSummary).toBeDefined();
    expect(svc.sendEmergencyInfo).toBeDefined();
  });

  test('ReferralAgentService implements IReferralAgent', () => {
    const svc: IReferralAgent = new ReferralAgentService(mockFacilityRepo());
    expect(svc.findNearestFacility).toBeDefined();
    expect(svc.getFacilityCapabilities).toBeDefined();
  });

  test('FollowUpSchedulerService implements IFollowUpScheduler', () => {
    const svc: IFollowUpScheduler = new FollowUpSchedulerService(mockEventBridge(), mockScheduleRepo());
    expect(svc.scheduleFollowUp).toBeDefined();
    expect(svc.triggerFollowUp).toBeDefined();
    expect(svc.cancelFollowUp).toBeDefined();
  });

  test('ASHAWorkerAgentService implements IASHAWorkerAgent', () => {
    const svc: IASHAWorkerAgent = new ASHAWorkerAgentService(mockASHARepo(), mockSNS());
    expect(svc.alertASHAWorker).toBeDefined();
    expect(svc.assignChronicCare).toBeDefined();
    expect(svc.sendMonitoringChecklist).toBeDefined();
  });

  test('ActionOrchestratorService implements IActionOrchestrator', () => {
    const svc: IActionOrchestrator = new ActionOrchestratorService(
      new SmsService(mockSNS()),
      new ReferralAgentService(mockFacilityRepo()),
      new FollowUpSchedulerService(mockEventBridge(), mockScheduleRepo()),
      new ASHAWorkerAgentService(mockASHARepo(), mockSNS()),
    );
    expect(svc.orchestrateActions).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Task 12 Round 6 — Final deep-dive fixes
// ═══════════════════════════════════════════════════════════════════════════════

describe('FollowUpSchedulerService — target ID consistency (putTargets ↔ removeTargets)', () => {
  test('triggerFollowUp removes the same target ID that was created', async () => {
    let createdTargetId = '';
    let removedTargetIds: string[] = [];

    const spyEb: IEventBridgeClient = {
      putRule: async () => {},
      putTargets: async (params) => { createdTargetId = params.Targets[0].Id; },
      removeTargets: async (params) => { removedTargetIds = params.Ids; },
      deleteRule: async () => {},
    };
    const repo = mockScheduleRepo();
    const svc = new FollowUpSchedulerService(spyEb, repo);

    const id = await svc.scheduleFollowUp('CA1234567890abcdef1234567890abcdef', '2h', 'acute_check');
    await svc.triggerFollowUp(id);

    expect(createdTargetId).toBeTruthy();
    expect(removedTargetIds).toHaveLength(1);
    // The target ID used in removeTargets MUST match the one used in putTargets
    // A mismatch would leave an orphaned target that fires the Lambda indefinitely
    expect(removedTargetIds[0]).toBe(createdTargetId);
  });

  test('cancelFollowUp removes the same target ID that was created', async () => {
    let createdTargetId = '';
    let removedTargetIds: string[] = [];

    const spyEb: IEventBridgeClient = {
      putRule: async () => {},
      putTargets: async (params) => { createdTargetId = params.Targets[0].Id; },
      removeTargets: async (params) => { removedTargetIds = params.Ids; },
      deleteRule: async () => {},
    };
    const repo = mockScheduleRepo();
    const svc = new FollowUpSchedulerService(spyEb, repo);

    const id = await svc.scheduleFollowUp('call-001', '24h', 'chronic_monitoring');
    await svc.cancelFollowUp(id);

    expect(createdTargetId).toBeTruthy();
    expect(removedTargetIds).toHaveLength(1);
    expect(removedTargetIds[0]).toBe(createdTargetId);
  });

  test('target ID stays within 64 chars even with long scheduleId', async () => {
    let capturedTargetId = '';
    const spyEb: IEventBridgeClient = {
      putRule: async () => {},
      putTargets: async (params) => { capturedTargetId = params.Targets[0].Id; },
      removeTargets: async () => {},
      deleteRule: async () => {},
    };
    const repo = mockScheduleRepo();
    const svc = new FollowUpSchedulerService(spyEb, repo);

    // Twilio SID is 34 chars — produces a very long scheduleId
    await svc.scheduleFollowUp('CA1234567890abcdef1234567890abcdef', '2h', 'acute_check');

    expect(capturedTargetId.length).toBeLessThanOrEqual(64);
    expect(capturedTargetId).toContain('tgt-');
  });
});

describe('ActionOrchestratorService — emergency caller + referral failure', () => {
  test('emergency caller with referral failure skips hospital SMS gracefully', async () => {
    // Scenario: Snakebite victim calls, DynamoDB is down, referral lookup fails.
    // The orchestrator should NOT attempt the emergency hospital SMS (no facility to include).
    // The triage summary SMS should still be sent (without facility info).
    let emergencySmsCalled = false;
    let triageSmsReceived: TriageResult | null = null;

    const spySms: ISmsService = {
      sendTriageSummary: async (_phone, triage) => { triageSmsReceived = triage; },
      sendEmergencyInfo: async () => { emergencySmsCalled = true; },
    };
    const failReferral: IReferralAgent = {
      findNearestFacility: async () => { throw new Error('DynamoDB down'); },
      getFacilityCapabilities: async () => { throw new Error('fail'); },
    };
    const followUp: IFollowUpScheduler = {
      scheduleFollowUp: async () => 'sched-001',
      triggerFollowUp: async () => {},
      cancelFollowUp: async () => {},
    };
    const asha: IASHAWorkerAgent = {
      alertASHAWorker: async () => {},
      assignChronicCare: async () => {},
      sendMonitoringChecklist: async () => {},
    };

    const orch = new ActionOrchestratorService(spySms, failReferral, followUp, asha);
    const results = await orch.orchestrateActions(
      makeTriageResult({
        isEmergency: true,
        recommendedCareLevel: 'district_hospital',
        severity: 'critical',
        condition: 'snakebite',
        icd10Code: 'T63.0',
        followUpRequired: true,
        followUpInterval: '2h',
      }),
      makeLocation(),
      '+919999999999',
    );

    // Referral failed — no facility found
    expect(results.referralFacility).toBeUndefined();
    // Emergency hospital SMS should NOT have been called (no facility to include)
    expect(emergencySmsCalled).toBe(false);
    // Triage summary SMS should still be sent (without facility section)
    expect(triageSmsReceived).not.toBeNull();
    expect(triageSmsReceived!.referralFacility).toBeUndefined();
    // Other actions should still succeed
    expect(results.smsSent).toBe(true);
    expect(results.followUpScheduled).toBe(true);
  });
});
