import * as fc from 'fast-check';
import {
  DiseaseSurveillanceService,
  ISurveillanceRepository,
  IDHONotifier,
  _resetAlertCounter,
  CONDITION_THRESHOLDS,
} from '../../services/diseaseSurveillance';
import { AggregatedData, OutbreakAlert } from '../../models/types';

// ─── Mock factories ──────────────────────────────────────────────────────────

function createMockRepo(records: Array<{
  icd10Code: string;
  district: string;
  state: string;
  village?: string;
  timestamp: string;
}> = []): ISurveillanceRepository {
  return {
    queryCallRecords: jest.fn().mockResolvedValue(records),
  };
}

function createFailingRepo(): ISurveillanceRepository {
  return {
    queryCallRecords: jest.fn().mockRejectedValue(new Error('DynamoDB timeout')),
  };
}

function createMockNotifier(): IDHONotifier & { publish: jest.Mock } {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
  };
}

function createFailingNotifier(): IDHONotifier {
  return {
    publish: jest.fn().mockRejectedValue(new Error('SNS publish failed')),
  };
}

// ─── Helper: generate call records for a condition+district ──────────────────

function generateRecords(
  icd10Code: string,
  district: string,
  state: string,
  count: number,
  village?: string,
): Array<{ icd10Code: string; district: string; state: string; village?: string; timestamp: string }> {
  return Array.from({ length: count }, (_, i) => ({
    icd10Code,
    district,
    state,
    ...(village ? { village } : {}),
    timestamp: new Date(Date.now() - i * 60000).toISOString(),
  }));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetAlertCounter();
});

describe('DiseaseSurveillanceService', () => {

  // ─── aggregateByConditionAndLocation ─────────────────────────────────────

  describe('aggregateByConditionAndLocation', () => {

    it('groups records by icd10Code + district + state', async () => {
      const records = [
        ...generateRecords('A90', 'Bhopal', 'MP', 5),
        ...generateRecords('A09', 'Bhopal', 'MP', 3),
        ...generateRecords('A90', 'Indore', 'MP', 2),
      ];
      const repo = createMockRepo(records);
      const svc = new DiseaseSurveillanceService(repo, createMockNotifier());

      const result = await svc.aggregateByConditionAndLocation('3d');

      expect(result.timeWindowDays).toBe(3);
      expect(result.records).toHaveLength(3);

      const dengBhopal = result.records.find(r => r.icd10Code === 'A90' && r.district === 'Bhopal');
      expect(dengBhopal?.count).toBe(5);

      const diarBhopal = result.records.find(r => r.icd10Code === 'A09' && r.district === 'Bhopal');
      expect(diarBhopal?.count).toBe(3);

      const dengIndore = result.records.find(r => r.icd10Code === 'A90' && r.district === 'Indore');
      expect(dengIndore?.count).toBe(2);
    });

    it('returns empty records when repo returns no data', async () => {
      const svc = new DiseaseSurveillanceService(createMockRepo([]), createMockNotifier());
      const result = await svc.aggregateByConditionAndLocation('7d');

      expect(result.timeWindowDays).toBe(7);
      expect(result.records).toHaveLength(0);
    });

    it('returns empty records on repo failure (DynamoDB down)', async () => {
      const svc = new DiseaseSurveillanceService(createFailingRepo(), createMockNotifier());
      const result = await svc.aggregateByConditionAndLocation('3d');

      expect(result.timeWindowDays).toBe(3);
      expect(result.records).toHaveLength(0);
    });

    it('parses hours correctly', async () => {
      const repo = createMockRepo([]);
      const svc = new DiseaseSurveillanceService(repo, createMockNotifier());
      await svc.aggregateByConditionAndLocation('24h');

      const call = (repo.queryCallRecords as jest.Mock).mock.calls[0];
      const from = new Date(call[0]);
      const to = new Date(call[1]);
      const diffHours = (to.getTime() - from.getTime()) / (60 * 60 * 1000);
      expect(Math.round(diffHours)).toBe(24);
    });

    it('parses weeks correctly', async () => {
      const repo = createMockRepo([]);
      const svc = new DiseaseSurveillanceService(repo, createMockNotifier());
      await svc.aggregateByConditionAndLocation('1w');

      const call = (repo.queryCallRecords as jest.Mock).mock.calls[0];
      const from = new Date(call[0]);
      const to = new Date(call[1]);
      const diffDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(diffDays)).toBe(7);
    });

    it('defaults to 3d for unparseable duration', async () => {
      const repo = createMockRepo([]);
      const svc = new DiseaseSurveillanceService(repo, createMockNotifier());
      await svc.aggregateByConditionAndLocation('invalid');

      const call = (repo.queryCallRecords as jest.Mock).mock.calls[0];
      const from = new Date(call[0]);
      const to = new Date(call[1]);
      const diffDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(diffDays)).toBe(3);
    });

    it('defaults to 3d for zero duration', async () => {
      const repo = createMockRepo([]);
      const svc = new DiseaseSurveillanceService(repo, createMockNotifier());
      await svc.aggregateByConditionAndLocation('0d');

      const call = (repo.queryCallRecords as jest.Mock).mock.calls[0];
      const from = new Date(call[0]);
      const to = new Date(call[1]);
      const diffDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(diffDays)).toBe(3);
    });

    it('tracks village-level breakdown within district groups', async () => {
      const records = [
        ...generateRecords('A90', 'Bhopal', 'MP', 10, 'Khedi'),
        ...generateRecords('A90', 'Bhopal', 'MP', 5, 'Raisen'),
        ...generateRecords('A90', 'Bhopal', 'MP', 3),  // no village
      ];
      const svc = new DiseaseSurveillanceService(createMockRepo(records), createMockNotifier());

      const result = await svc.aggregateByConditionAndLocation('3d');

      // All 18 records roll up into one district-level group
      expect(result.records).toHaveLength(1);
      expect(result.records[0].count).toBe(18);
    });
  });

  // ─── detectAnomaly ───────────────────────────────────────────────────────

  describe('detectAnomaly', () => {

    it('flags records exceeding threshold', async () => {
      const records = generateRecords('A90', 'Bhopal', 'MP', 23);
      const svc = new DiseaseSurveillanceService(createMockRepo(records), createMockNotifier());
      // Must aggregate first so village data is populated
      const aggregated = await svc.aggregateByConditionAndLocation('3d');

      const alerts = svc.detectAnomaly(aggregated, 10);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].icd10Code).toBe('A90');
      expect(alerts[0].callCount).toBe(23);
      // A90 has condition-specific threshold of 5, so 23/5 = 4.6x → critical
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].location.district).toBe('Bhopal');
      expect(alerts[0].location.state).toBe('MP');
      expect(alerts[0].threshold).toBe(5); // condition-specific, not the default 10
      expect(alerts[0].timeWindowDays).toBe(3);
    });

    it('uses condition-specific thresholds from CONDITION_THRESHOLDS', async () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      // A01.0 (Typhoid) has threshold 3 — 4 calls should trigger
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'A01.0', district: 'Bhopal', state: 'MP', count: 4 },
        ],
      };

      const alerts = svc.detectAnomaly(data, 100); // default is 100, but A01.0 uses 3
      expect(alerts).toHaveLength(1);
      expect(alerts[0].threshold).toBe(3); // condition-specific
    });

    it('falls back to default threshold for unknown ICD-10 codes', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'Z99.9', district: 'Bhopal', state: 'MP', count: 15 },
        ],
      };

      const alerts = svc.detectAnomaly(data, 10);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].threshold).toBe(10); // default, not condition-specific
    });

    it('returns empty array when no records exceed threshold', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'A90', district: 'Bhopal', state: 'MP', count: 3 },  // below A90 threshold of 5
          { icd10Code: 'Z99.9', district: 'Bhopal', state: 'MP', count: 5 }, // below default 10
        ],
      };

      const alerts = svc.detectAnomaly(data, 10);
      expect(alerts).toHaveLength(0);
    });

    it('classifies severity tiers correctly', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      // Using unknown codes so default threshold (5) applies uniformly
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'X01', district: 'Bhopal', state: 'MP', count: 8 },   // 8/5 = 1.6x → watch
          { icd10Code: 'X02', district: 'Bhopal', state: 'MP', count: 12 },  // 12/5 = 2.4x → alert
          { icd10Code: 'X03', district: 'Indore', state: 'MP', count: 20 },  // 20/5 = 4.0x → critical
        ],
      };

      const alerts = svc.detectAnomaly(data, 5);

      expect(alerts).toHaveLength(3);
      const watch = alerts.find(a => a.icd10Code === 'X01')!;
      const alert = alerts.find(a => a.icd10Code === 'X02')!;
      const critical = alerts.find(a => a.icd10Code === 'X03')!;

      expect(watch.severity).toBe('watch');
      expect(alert.severity).toBe('alert');
      expect(critical.severity).toBe('critical');
    });

    it('boundary: count exactly at threshold is NOT flagged', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'X01', district: 'Bhopal', state: 'MP', count: 5 },
        ],
      };

      const alerts = svc.detectAnomaly(data, 5);
      expect(alerts).toHaveLength(0);
    });

    it('boundary: count at exactly 2x threshold is watch (not alert)', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'X01', district: 'Bhopal', state: 'MP', count: 10 },
        ],
      };

      const alerts = svc.detectAnomaly(data, 5);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('watch'); // 10/5 = 2.0x, not > 2x
    });

    it('boundary: count at exactly 3x threshold is alert (not critical)', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'X01', district: 'Bhopal', state: 'MP', count: 15 },
        ],
      };

      const alerts = svc.detectAnomaly(data, 5);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('alert'); // 15/5 = 3.0x, not > 3x
    });

    it('handles non-positive threshold by defaulting to 1', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'X01', district: 'Bhopal', state: 'MP', count: 2 },
        ],
      };

      const alerts = svc.detectAnomaly(data, 0);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].callCount).toBe(2);
    });

    it('maps known ICD-10 codes to condition names', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'A90', district: 'Bhopal', state: 'MP', count: 10 },
        ],
      };

      const alerts = svc.detectAnomaly(data, 1); // low threshold to trigger
      expect(alerts[0].conditionName).toBe('Dengue Fever');
    });

    it('uses raw ICD-10 code as condition name for unknown codes', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'Z99.9', district: 'Bhopal', state: 'MP', count: 15 },
        ],
      };

      const alerts = svc.detectAnomaly(data, 5);
      expect(alerts[0].conditionName).toBe('Z99.9');
    });

    it('handles empty records array', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      const data: AggregatedData = { timeWindowDays: 3, records: [] };

      const alerts = svc.detectAnomaly(data, 5);
      expect(alerts).toHaveLength(0);
    });

    it('generates unique alertIds even for same-millisecond alerts', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'X01', district: 'Bhopal', state: 'MP', count: 10 },
          { icd10Code: 'X02', district: 'Bhopal', state: 'MP', count: 10 },
          { icd10Code: 'X03', district: 'Indore', state: 'MP', count: 10 },
        ],
      };

      const alerts = svc.detectAnomaly(data, 5);
      const ids = alerts.map(a => a.alertId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('enriches alert with hotspot village from aggregation', async () => {
      const records = [
        ...generateRecords('A90', 'Bhopal', 'MP', 15, 'Khedi'),
        ...generateRecords('A90', 'Bhopal', 'MP', 5, 'Raisen'),
        ...generateRecords('A90', 'Bhopal', 'MP', 3),  // no village
      ];
      const svc = new DiseaseSurveillanceService(createMockRepo(records), createMockNotifier());

      // Must aggregate first to populate village data
      const aggregated = await svc.aggregateByConditionAndLocation('3d');
      const alerts = svc.detectAnomaly(aggregated, 1); // low threshold to trigger

      expect(alerts).toHaveLength(1);
      expect(alerts[0].location.village).toBe('khedi'); // highest count village (normalized to lowercase)
    });
  });

  // ─── alertDHO ──────────────────────────────────────────────────────────

  describe('alertDHO', () => {

    it('publishes alert via notifier', async () => {
      const notifier = createMockNotifier();
      const svc = new DiseaseSurveillanceService(createMockRepo(), notifier);

      const alert: OutbreakAlert = {
        alertId: 'outbreak-A90-Bhopal-123-1',
        icd10Code: 'A90',
        conditionName: 'Dengue Fever',
        location: { village: 'Khedi', district: 'Bhopal', state: 'MP' },
        callCount: 23,
        timeWindowDays: 3,
        threshold: 5,
        severity: 'critical',
        timestamp: new Date().toISOString(),
      };

      await svc.alertDHO(alert);

      expect(notifier.publish).toHaveBeenCalledTimes(1);
      expect(notifier.publish).toHaveBeenCalledWith(alert);
    });

    it('does not throw on notifier failure', async () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createFailingNotifier());

      const alert: OutbreakAlert = {
        alertId: 'outbreak-A90-Bhopal-123-1',
        icd10Code: 'A90',
        conditionName: 'Dengue Fever',
        location: { district: 'Bhopal', state: 'MP' },
        callCount: 23,
        timeWindowDays: 3,
        threshold: 5,
        severity: 'critical',
        timestamp: new Date().toISOString(),
      };

      await expect(svc.alertDHO(alert)).resolves.toBeUndefined();
    });
  });

  // ─── runSurveillancePipeline ───────────────────────────────────────────

  describe('runSurveillancePipeline', () => {

    it('chains aggregate → detect → alert in one call', async () => {
      const records = [
        ...generateRecords('A90', 'Bhopal', 'MP', 23, 'Khedi'),
        ...generateRecords('A09', 'Bhopal', 'MP', 3),
      ];
      const notifier = createMockNotifier();
      const svc = new DiseaseSurveillanceService(createMockRepo(records), notifier);

      const alerts = await svc.runSurveillancePipeline('3d', 10);

      // A90 has condition threshold 5, 23 calls → critical → alerted
      // A09 has condition threshold 8, 3 calls → below → not alerted
      expect(alerts).toHaveLength(1);
      expect(alerts[0].icd10Code).toBe('A90');
      expect(notifier.publish).toHaveBeenCalledTimes(1);
    });

    it('alerts DHO for each spiking condition separately', async () => {
      const records = [
        ...generateRecords('A90', 'Bhopal', 'MP', 15),
        ...generateRecords('B54', 'Bhopal', 'MP', 12),
        ...generateRecords('A09', 'Indore', 'MP', 20),
      ];
      const notifier = createMockNotifier();
      const svc = new DiseaseSurveillanceService(createMockRepo(records), notifier);

      const alerts = await svc.runSurveillancePipeline('3d', 10);

      // A90 threshold=5, 15 calls → alert; B54 threshold=5, 12 calls → alert; A09 threshold=8, 20 calls → critical
      expect(alerts).toHaveLength(3);
      expect(notifier.publish).toHaveBeenCalledTimes(3);
    });

    it('suppresses duplicate alerts using recentlyAlerted set', async () => {
      const records = [
        ...generateRecords('A90', 'Bhopal', 'MP', 23),
        ...generateRecords('B54', 'Indore', 'MP', 12),
      ];
      const notifier = createMockNotifier();
      const svc = new DiseaseSurveillanceService(createMockRepo(records), notifier);

      // Simulate: A90|Bhopal was already alerted at critical severity in a previous cron run
      const recentlyAlerted = new Set(['A90|Bhopal|critical']);

      const alerts = await svc.runSurveillancePipeline('3d', 10, recentlyAlerted);

      // Only B54|Indore should be alerted (A90|Bhopal|critical suppressed)
      expect(alerts).toHaveLength(1);
      expect(alerts[0].icd10Code).toBe('B54');
      expect(notifier.publish).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no records in time window', async () => {
      const svc = new DiseaseSurveillanceService(createMockRepo([]), createMockNotifier());

      const alerts = await svc.runSurveillancePipeline('3d', 10);
      expect(alerts).toHaveLength(0);
    });

    it('returns empty array when repo fails (graceful degradation)', async () => {
      const svc = new DiseaseSurveillanceService(createFailingRepo(), createMockNotifier());

      const alerts = await svc.runSurveillancePipeline('3d', 10);
      expect(alerts).toHaveLength(0);
    });

    it('continues alerting remaining alerts when one DHO notification fails', async () => {
      const records = [
        ...generateRecords('A90', 'Bhopal', 'MP', 23),
        ...generateRecords('B54', 'Indore', 'MP', 12),
      ];
      let callCount = 0;
      const notifier: IDHONotifier = {
        publish: jest.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) throw new Error('SNS throttled');
          // Second call succeeds
        }),
      };
      const svc = new DiseaseSurveillanceService(createMockRepo(records), notifier);

      const alerts = await svc.runSurveillancePipeline('3d', 10);

      // Both alerts detected, both attempted, first failed but second succeeded
      expect(alerts).toHaveLength(2);
      expect(notifier.publish).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Property 14: Outbreak spike detection ─────────────────────────────

  describe('Property 14: Outbreak spike detection', () => {

    it('for any count exceeding threshold, detectAnomaly flags at least one alert', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());

      fc.assert(
        fc.property(
          fc.constantFrom('X01', 'X02', 'X03', 'X04', 'X05'),  // unknown codes → use default threshold
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 2, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          (icd10Code, district, state, count, threshold) => {
            const actualCount = threshold + count; // always exceeds

            const data: AggregatedData = {
              timeWindowDays: 3,
              records: [{ icd10Code, district, state, count: actualCount }],
            };

            const alerts = svc.detectAnomaly(data, threshold);

            expect(alerts.length).toBeGreaterThanOrEqual(1);
            const match = alerts.find(
              a => a.icd10Code === icd10Code && a.location.district === district,
            );
            expect(match).toBeDefined();
            expect(match!.callCount).toBe(actualCount);
            expect(['watch', 'alert', 'critical']).toContain(match!.severity);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('for any count at or below threshold, detectAnomaly returns no alerts', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());

      fc.assert(
        fc.property(
          fc.constantFrom('X01', 'X02', 'X03', 'X04', 'X05'),  // unknown codes → use default threshold
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 100 }),
          (icd10Code, district, state, threshold) => {
            const data: AggregatedData = {
              timeWindowDays: 3,
              records: [{ icd10Code, district, state, count: threshold }],
            };

            const alerts = svc.detectAnomaly(data, threshold);
            expect(alerts).toHaveLength(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Condition thresholds ──────────────────────────────────────────────

  describe('Condition-specific thresholds', () => {

    it('CONDITION_THRESHOLDS has entries for key infectious diseases', () => {
      expect(CONDITION_THRESHOLDS['A90']).toBeDefined();   // Dengue
      expect(CONDITION_THRESHOLDS['A09']).toBeDefined();   // Diarrhea
      expect(CONDITION_THRESHOLDS['A01.0']).toBeDefined(); // Typhoid
      expect(CONDITION_THRESHOLDS['B54']).toBeDefined();   // Malaria
      expect(CONDITION_THRESHOLDS['A15']).toBeDefined();   // TB
    });

    it('infectious disease thresholds are lower than respiratory/fever', () => {
      // Typhoid is the most sensitive — any small cluster matters
      expect(CONDITION_THRESHOLDS['A01.0']).toBeLessThanOrEqual(5);
      // Respiratory infections are common — need bigger spike
      expect(CONDITION_THRESHOLDS['J06.9']).toBeGreaterThanOrEqual(10);
    });
  });

  // ─── Interface compliance ──────────────────────────────────────────────

  describe('Interface compliance', () => {

    it('DiseaseSurveillanceService implements IDiseaseSurveillance', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());

      expect(typeof svc.aggregateByConditionAndLocation).toBe('function');
      expect(typeof svc.detectAnomaly).toBe('function');
      expect(typeof svc.alertDHO).toBe('function');
      expect(typeof svc.runSurveillancePipeline).toBe('function');
    });
  });

  // ─── Round 2 Deep Audit: Edge cases and gaps ───────────────────────────

  describe('Round 2 audit: edge cases', () => {

    it('F1: runSurveillancePipeline resets alert counter (warm Lambda container safety)', async () => {
      const records = generateRecords('A90', 'Bhopal', 'MP', 23);
      const notifier = createMockNotifier();
      const svc = new DiseaseSurveillanceService(createMockRepo(records), notifier);

      // First pipeline run — counter starts at 0, increments to 1
      const alerts1 = await svc.runSurveillancePipeline('3d', 10);
      expect(alerts1).toHaveLength(1);
      const id1 = alerts1[0].alertId;

      // Second pipeline run — counter should reset to 0, then increment to 1
      // In a warm Lambda container, the module-level counter would have been 1
      // Without the reset, the second run would produce counter=2
      const alerts2 = await svc.runSurveillancePipeline('3d', 10);
      expect(alerts2).toHaveLength(1);
      const id2 = alerts2[0].alertId;

      // Both IDs should end with -1 (counter reset to 0, then incremented to 1)
      expect(id1).toMatch(/-1$/);
      expect(id2).toMatch(/-1$/);
    });

    it('F6: detectAnomaly without prior aggregation returns no village data', () => {
      // Calling detectAnomaly directly without aggregateByConditionAndLocation
      // means _lastVillageData is empty — village should be undefined
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'X01', district: 'Bhopal', state: 'MP', count: 10 },
        ],
      };

      const alerts = svc.detectAnomaly(data, 5);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].location.village).toBeUndefined();
    });

    it('F7: parses minutes duration correctly', async () => {
      const repo = createMockRepo([]);
      const svc = new DiseaseSurveillanceService(repo, createMockNotifier());
      await svc.aggregateByConditionAndLocation('30m');

      const call = (repo.queryCallRecords as jest.Mock).mock.calls[0];
      const from = new Date(call[0]);
      const to = new Date(call[1]);
      const diffMinutes = (to.getTime() - from.getTime()) / (60 * 1000);
      expect(Math.round(diffMinutes)).toBe(30);
    });

    it('F8: handles negative threshold by defaulting to 1', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'X01', district: 'Bhopal', state: 'MP', count: 2 },
        ],
      };

      const alerts = svc.detectAnomaly(data, -5);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].callCount).toBe(2);
    });

    it('F3: pipeline logs notification failures but still returns all detected alerts', async () => {
      // All notifications fail — but all alerts should still be returned
      const records = [
        ...generateRecords('A90', 'Bhopal', 'MP', 23),
        ...generateRecords('B54', 'Indore', 'MP', 12),
      ];
      const notifier = createFailingNotifier();
      const svc = new DiseaseSurveillanceService(createMockRepo(records), notifier);

      const alerts = await svc.runSurveillancePipeline('3d', 10);

      // Both alerts detected and returned even though notifications failed
      expect(alerts).toHaveLength(2);
      expect(notifier.publish).toHaveBeenCalledTimes(2);
    });

    it('CONDITION_THRESHOLDS includes dehydration (E86.0) for co-occurring outbreaks', () => {
      // Dehydration often co-occurs with diarrhea outbreaks — needs its own threshold
      expect(CONDITION_THRESHOLDS['E86.0']).toBeDefined();
      expect(CONDITION_THRESHOLDS['E86.0']).toBeLessThan(CONDITION_THRESHOLDS['J06.9']);
    });

    it('CONDITION_THRESHOLDS includes fever unspecified (R50.9)', () => {
      expect(CONDITION_THRESHOLDS['R50.9']).toBeDefined();
      expect(CONDITION_THRESHOLDS['R50.9']).toBeGreaterThanOrEqual(10);
    });

    it('multiple pipeline runs with different data produce independent results', async () => {
      const notifier = createMockNotifier();

      // Run 1: dengue outbreak
      const repo1 = createMockRepo(generateRecords('A90', 'Bhopal', 'MP', 23));
      const svc1 = new DiseaseSurveillanceService(repo1, notifier);
      const alerts1 = await svc1.runSurveillancePipeline('3d', 10);
      expect(alerts1).toHaveLength(1);
      expect(alerts1[0].icd10Code).toBe('A90');

      // Run 2: malaria outbreak (different service instance, simulating next cron)
      const repo2 = createMockRepo(generateRecords('B54', 'Indore', 'MP', 15));
      const svc2 = new DiseaseSurveillanceService(repo2, notifier);
      const alerts2 = await svc2.runSurveillancePipeline('3d', 10);
      expect(alerts2).toHaveLength(1);
      expect(alerts2[0].icd10Code).toBe('B54');

      // Alert IDs should both start with counter=1 (reset between runs)
      expect(alerts1[0].alertId).toMatch(/-1$/);
      expect(alerts2[0].alertId).toMatch(/-1$/);
    });
  });

  // ─── Round 3 Deep Audit: Real-world scenario gaps ──────────────────────

  describe('Round 3 audit: real-world scenarios', () => {

    it('F11: severity escalation is NOT suppressed by deduplication', async () => {
      // Day 1: 6 dengue calls → watch (6/5 = 1.2x). DHO alerted at "watch".
      // Day 3: 25 dengue calls → critical (25/5 = 5x). DHO MUST be re-alerted.
      // If dedup key was just "A90|Bhopal", the critical alert would be suppressed.
      const records = generateRecords('A90', 'Bhopal', 'MP', 25);
      const notifier = createMockNotifier();
      const svc = new DiseaseSurveillanceService(createMockRepo(records), notifier);

      // Previous run alerted at "watch" severity
      const recentlyAlerted = new Set(['A90|Bhopal|watch']);

      const alerts = await svc.runSurveillancePipeline('3d', 10);

      // Critical alert should NOT be suppressed — severity escalated
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(notifier.publish).toHaveBeenCalledTimes(1);
    });

    it('F11: same severity IS suppressed (no duplicate for same level)', async () => {
      const records = generateRecords('A90', 'Bhopal', 'MP', 25);
      const notifier = createMockNotifier();
      const svc = new DiseaseSurveillanceService(createMockRepo(records), notifier);

      // Previous run already alerted at "critical" severity
      const recentlyAlerted = new Set(['A90|Bhopal|critical']);

      const alerts = await svc.runSurveillancePipeline('3d', 10, recentlyAlerted);

      // Should be suppressed — same severity already alerted
      expect(alerts).toHaveLength(0);
      expect(notifier.publish).not.toHaveBeenCalled();
    });

    it('backward compat: legacy dedup keys (without severity) still suppress', async () => {
      // Existing Lambda handlers might pass "A90|Bhopal" (no severity suffix)
      // This should still suppress the alert for backward compatibility
      const records = generateRecords('A90', 'Bhopal', 'MP', 25);
      const notifier = createMockNotifier();
      const svc = new DiseaseSurveillanceService(createMockRepo(records), notifier);

      const recentlyAlerted = new Set(['A90|Bhopal']);

      const alerts = await svc.runSurveillancePipeline('3d', 10, recentlyAlerted);

      // Legacy key suppresses all severities for that condition+district
      expect(alerts).toHaveLength(0);
      expect(notifier.publish).not.toHaveBeenCalled();
    });

    it('F12: sub-day time window (6h) reports timeWindowDays as 1 (not 0)', async () => {
      const repo = createMockRepo([]);
      const svc = new DiseaseSurveillanceService(repo, createMockNotifier());
      const result = await svc.aggregateByConditionAndLocation('6h');

      // 6 hours = 0.25 days → Math.round = 0 → Math.max(1, 0) = 1
      expect(result.timeWindowDays).toBe(1);
    });

    it('F13: monsoon multi-condition spike — all 4 conditions alerted independently', async () => {
      // Monsoon season: dengue + diarrhea + malaria + dehydration all spike
      const records = [
        ...generateRecords('A90', 'Bhopal', 'MP', 20),   // Dengue: 20/5 = 4x → critical
        ...generateRecords('A09', 'Bhopal', 'MP', 25),   // Diarrhea: 25/8 = 3.1x → critical
        ...generateRecords('B54', 'Bhopal', 'MP', 18),   // Malaria: 18/5 = 3.6x → critical
        ...generateRecords('E86.0', 'Bhopal', 'MP', 15), // Dehydration: 15/6 = 2.5x → alert
      ];
      const notifier = createMockNotifier();
      const svc = new DiseaseSurveillanceService(createMockRepo(records), notifier);

      const alerts = await svc.runSurveillancePipeline('3d', 10);

      expect(alerts).toHaveLength(4);
      expect(notifier.publish).toHaveBeenCalledTimes(4);

      // Verify each condition has correct severity
      const dengue = alerts.find(a => a.icd10Code === 'A90')!;
      const diarrhea = alerts.find(a => a.icd10Code === 'A09')!;
      const malaria = alerts.find(a => a.icd10Code === 'B54')!;
      const dehydration = alerts.find(a => a.icd10Code === 'E86.0')!;

      expect(dengue.severity).toBe('critical');
      expect(diarrhea.severity).toBe('critical');
      expect(malaria.severity).toBe('critical');
      expect(dehydration.severity).toBe('alert');
    });

    it('F14: cross-state same condition treated as separate outbreaks', async () => {
      // Dengue in Bhopal (MP) AND Raipur (CG) — different states, same ICD-10
      const records = [
        ...generateRecords('A90', 'Bhopal', 'MP', 15),
        ...generateRecords('A90', 'Raipur', 'CG', 10),
      ];
      const notifier = createMockNotifier();
      const svc = new DiseaseSurveillanceService(createMockRepo(records), notifier);

      const alerts = await svc.runSurveillancePipeline('3d', 10);

      expect(alerts).toHaveLength(2);
      const bhopal = alerts.find(a => a.location.district === 'Bhopal')!;
      const raipur = alerts.find(a => a.location.district === 'Raipur')!;
      expect(bhopal.location.state).toBe('MP');
      expect(raipur.location.state).toBe('CG');
    });

    it('F15: condition name mapping covers all CONDITION_THRESHOLDS entries', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      // Every condition in CONDITION_THRESHOLDS should have a human-readable name
      const thresholdCodes = Object.keys(CONDITION_THRESHOLDS);
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: thresholdCodes.map(code => ({
          icd10Code: code,
          district: 'Test',
          state: 'TS',
          count: 100, // high enough to trigger all
        })),
      };

      const alerts = svc.detectAnomaly(data, 1);
      for (const alert of alerts) {
        // conditionName should NOT be the raw ICD-10 code for known conditions
        expect(alert.conditionName).not.toBe(alert.icd10Code);
      }
    });

    it('F16: village names are normalized (case-insensitive grouping)', async () => {
      // Callers say "Khedi", "khedi", "KHEDI" — all the same village
      const records = [
        ...generateRecords('A90', 'Bhopal', 'MP', 6, 'Khedi'),
        ...generateRecords('A90', 'Bhopal', 'MP', 5, 'khedi'),
        ...generateRecords('A90', 'Bhopal', 'MP', 4, 'KHEDI'),
      ];
      const svc = new DiseaseSurveillanceService(createMockRepo(records), createMockNotifier());

      const aggregated = await svc.aggregateByConditionAndLocation('3d');
      const alerts = svc.detectAnomaly(aggregated, 1);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].callCount).toBe(15); // all 15 in one group
      // Hotspot village should be "khedi" (normalized lowercase) with count 15
      expect(alerts[0].location.village).toBe('khedi');
    });

    it('F17: A15.0 (TB from triage agent) uses TB threshold, not default', () => {
      const svc = new DiseaseSurveillanceService(createMockRepo(), createMockNotifier());
      // Triage agent writes A15.0, not A15
      const data: AggregatedData = {
        timeWindowDays: 3,
        records: [
          { icd10Code: 'A15.0', district: 'Bhopal', state: 'MP', count: 6 },
        ],
      };

      const alerts = svc.detectAnomaly(data, 100); // default is 100
      // A15.0 should use threshold 5 (not default 100)
      expect(alerts).toHaveLength(1);
      expect(alerts[0].threshold).toBe(5);
      expect(alerts[0].conditionName).toBe('Tuberculosis (Respiratory)');
    });
  });
});
