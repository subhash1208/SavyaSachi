import { AggregatedData, OutbreakAlert } from '../models/types';
import { IDiseaseSurveillance } from '../interfaces/IDiseaseSurveillance';
import { Duration } from '../models/enums';
import { Logger } from '../utils/logger';

// ─── Disease Surveillance Agent ──────────────────────────────────────────────
// Req 8.5: Detect anomalous spikes in specific conditions within geographic
//          clusters (e.g., "23 calls with ICD-10 A90 Dengue from Khedi village
//          in 3 days") and flag potential outbreaks.
// Req 8.6: Alert the District Health Officer via analytics dashboard with
//          geographic heatmap and condition breakdown.
//
// Architecture:
//   - aggregateByConditionAndLocation: queries DynamoDB call records, groups by
//     ICD-10 code + district + state (+ optional village) within a time window.
//   - detectAnomaly: pure function — compares each record's count against
//     condition-specific thresholds. Assigns severity tiers.
//   - alertDHO: publishes an SNS notification to the DHO topic.
//   - runSurveillancePipeline: chains aggregate → detect → alert in one call.
//
// This is a batch/scheduled service — triggered by EventBridge on a cron
// (e.g., every 6 hours), NOT on every call. The Action Orchestrator's
// _logSurveillance just writes the call record; this service reads them later.

/**
 * Repository interface for call record aggregation.
 * Injected via DI — production uses DynamoDB, tests use mocks.
 */
export interface ISurveillanceRepository {
  queryCallRecords(fromTimestamp: string, toTimestamp: string): Promise<Array<{
    icd10Code: string;
    district: string;
    state: string;
    village?: string;
    timestamp: string;
  }>>;
}

/**
 * SNS notification interface for DHO alerts.
 * Injected via DI — production uses SNS, tests use mocks.
 */
export interface IDHONotifier {
  publish(alert: OutbreakAlert): Promise<void>;
}

/**
 * Condition-specific baseline thresholds.
 * Infectious diseases (dengue, diarrhea, malaria, typhoid) have lower
 * thresholds because even a small cluster is epidemiologically significant.
 * Chronic/non-communicable conditions have higher thresholds.
 * Falls back to a default of 10 for unknown ICD-10 codes.
 */
const CONDITION_THRESHOLDS: Record<string, number> = {
  'A90':   5,   // Dengue — highly clustered, low baseline
  'A09':   8,   // Diarrhea — common but clusters matter
  'A01.0': 3,   // Typhoid — very low baseline, any cluster is suspicious
  'A15':   5,   // TB — clusters indicate transmission (category level)
  'A15.0': 5,   // TB — respiratory (subcategory from triage agent)
  'B54':   5,   // Malaria — seasonal clusters
  'J06.9': 15,  // Upper respiratory — high baseline, needs bigger spike
  'R50.9': 12,  // Fever unspecified — common, needs bigger spike
  'E86.0': 6,   // Dehydration — often co-occurs with diarrhea outbreaks
};

const DEFAULT_THRESHOLD = 10;

/**
 * Counter for generating unique alert IDs within a single run.
 * IMPORTANT: This is module-level state. In Lambda warm containers, the module
 * is loaded once and reused across invocations. The counter is reset at the
 * start of each `runSurveillancePipeline()` call to prevent cross-invocation
 * leakage. Direct callers of `detectAnomaly()` should call `_resetAlertCounter()`
 * manually if they need deterministic IDs.
 */
let _alertCounter = 0;

export class DiseaseSurveillanceService implements IDiseaseSurveillance {

  constructor(
    private readonly _repo: ISurveillanceRepository,
    private readonly _notifier: IDHONotifier,
  ) {}

  /**
   * Aggregates call records by ICD-10 code + district (+ village when available)
   * within a time window.
   *
   * Real-world scenario: Every 6 hours, EventBridge triggers this Lambda.
   * It scans the last 3 days of call records and groups them:
   *   - A90 (Dengue) + Khedi village + Bhopal district + MP = 23 calls
   *   - A09 (Diarrhea) + Bhopal district + MP = 8 calls (no village data)
   *   - I21.9 (Cardiac) + Indore district + MP = 2 calls
   *
   * Records with village data are aggregated at village level for finer
   * granularity (Req 8.5 example: "Khedi village"). Records without village
   * data are aggregated at district level only.
   *
   * @param timeWindow Duration string (e.g., "3d", "7d", "24h")
   * @returns Aggregated data grouped by condition + location
   */
  async aggregateByConditionAndLocation(timeWindow: Duration): Promise<AggregatedData> {
    const windowMs = this._parseDuration(timeWindow);
    const now = new Date();
    const from = new Date(now.getTime() - windowMs);
    const timeWindowDays = Math.max(1, Math.round(windowMs / (24 * 60 * 60 * 1000)));

    try {
      const records = await this._repo.queryCallRecords(
        from.toISOString(),
        now.toISOString(),
      );

      // Group by composite key: icd10Code + district + state
      // Village is tracked per-group but not part of the grouping key
      // (multiple villages roll up into the district count for threshold comparison)
      const groups = new Map<string, {
        icd10Code: string;
        district: string;
        state: string;
        count: number;
        villages: Map<string, number>;  // village → count (for sub-district granularity)
      }>();

      for (const record of records) {
        const key = `${record.icd10Code}|${record.district}|${record.state}`;
        // Normalize village name to lowercase for consistent grouping.
        // Village names come from Tier 1 voice input — callers may say
        // "Khedi", "khedi", or "KHEDI" for the same village.
        const normalizedVillage = record.village?.toLowerCase().trim();
        const existing = groups.get(key);
        if (existing) {
          existing.count++;
          if (normalizedVillage) {
            existing.villages.set(
              normalizedVillage,
              (existing.villages.get(normalizedVillage) || 0) + 1,
            );
          }
        } else {
          const villages = new Map<string, number>();
          if (normalizedVillage) {
            villages.set(normalizedVillage, 1);
          }
          groups.set(key, {
            icd10Code: record.icd10Code,
            district: record.district,
            state: record.state,
            count: 1,
            villages,
          });
        }
      }

      Logger.info('Surveillance aggregation complete', {
        timeWindowDays,
        totalRecords: records.length,
        uniqueGroups: groups.size,
      });

      // Convert to AggregatedData format (villages stored internally for alert enrichment)
      // We store the village data on the service instance for use in detectAnomaly
      this._lastVillageData = new Map();
      const aggregatedRecords: AggregatedData['records'] = [];

      for (const group of groups.values()) {
        aggregatedRecords.push({
          icd10Code: group.icd10Code,
          district: group.district,
          state: group.state,
          count: group.count,
        });
        const groupKey = `${group.icd10Code}|${group.district}|${group.state}`;
        this._lastVillageData.set(groupKey, group.villages);
      }

      return {
        timeWindowDays,
        records: aggregatedRecords,
      };
    } catch (err) {
      Logger.error('Surveillance aggregation failed', {
        error: (err as Error).message,
        timeWindow,
      });

      // Return empty aggregation on failure — don't crash the scheduled job
      return { timeWindowDays, records: [] };
    }
  }

  /** Village breakdown data from the last aggregation — used to enrich alerts */
  private _lastVillageData = new Map<string, Map<string, number>>();

  /**
   * Detects anomalous spikes by comparing each record's count against
   * condition-specific thresholds. Uses CONDITION_THRESHOLDS lookup for
   * infectious diseases, falls back to the provided threshold parameter
   * for unknown conditions.
   *
   * Severity tiers:
   *   - watch:    count > threshold AND count <= 2x threshold
   *   - alert:    count > 2x threshold AND count <= 3x threshold
   *   - critical: count > 3x threshold
   *
   * Real-world scenario: Dengue threshold = 5 (from CONDITION_THRESHOLDS).
   *   - 6 calls → watch (slightly above normal, monitor)
   *   - 12 calls → alert (DHO should investigate)
   *   - 23 calls → critical (outbreak likely, immediate response needed)
   *
   * @param aggregatedData Output from aggregateByConditionAndLocation
   * @param threshold Default baseline count for conditions not in CONDITION_THRESHOLDS
   * @returns Array of OutbreakAlert for each anomalous condition+location
   */
  detectAnomaly(aggregatedData: AggregatedData, threshold: number): OutbreakAlert[] {
    if (threshold <= 0) {
      Logger.warn('detectAnomaly called with non-positive threshold, defaulting to 1', { threshold });
      threshold = 1;
    }

    const alerts: OutbreakAlert[] = [];

    for (const record of aggregatedData.records) {
      // Use condition-specific threshold if available, otherwise use the provided default
      const effectiveThreshold = CONDITION_THRESHOLDS[record.icd10Code] ?? threshold;

      if (record.count > effectiveThreshold) {
        const severity = this._classifySeverity(record.count, effectiveThreshold);

        // Enrich with village data if available from last aggregation
        const groupKey = `${record.icd10Code}|${record.district}|${record.state}`;
        const villages = this._lastVillageData.get(groupKey);
        // Pick the village with the highest count (hotspot)
        let hotspotVillage: string | undefined;
        if (villages && villages.size > 0) {
          let maxCount = 0;
          for (const [village, count] of villages) {
            if (count > maxCount) {
              maxCount = count;
              hotspotVillage = village;
            }
          }
        }

        alerts.push({
          alertId: this._generateAlertId(record.icd10Code, record.district),
          icd10Code: record.icd10Code,
          conditionName: this._icd10ToConditionName(record.icd10Code),
          location: {
            village: hotspotVillage,
            district: record.district,
            state: record.state,
          },
          callCount: record.count,
          timeWindowDays: aggregatedData.timeWindowDays,
          threshold: effectiveThreshold,
          severity,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (alerts.length > 0) {
      Logger.info('Anomalies detected', {
        alertCount: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        alert: alerts.filter(a => a.severity === 'alert').length,
        watch: alerts.filter(a => a.severity === 'watch').length,
      });
    }

    return alerts;
  }

  /**
   * Alerts the District Health Officer via SNS notification.
   * In production, this also triggers a QuickSight dashboard refresh
   * with geographic heatmap data.
   *
   * Real-world scenario: 23 dengue calls from Khedi village in 3 days.
   * The DHO of Bhopal district receives an SMS + email:
   *   "OUTBREAK ALERT: 23 Dengue Fever cases in Bhopal district, MP
   *    (hotspot: Khedi village) in last 3 days (baseline: 5). Severity: CRITICAL.
   *    Immediate investigation recommended."
   *
   * Failures are logged but don't throw — surveillance is non-blocking.
   */
  async alertDHO(alert: OutbreakAlert): Promise<void> {
    try {
      await this._notifier.publish(alert);

      Logger.info('DHO alert sent', {
        alertId: alert.alertId,
        icd10Code: alert.icd10Code,
        district: alert.location.district,
        village: alert.location.village,
        severity: alert.severity,
        callCount: alert.callCount,
      });
    } catch (err) {
      Logger.error('DHO alert failed', {
        alertId: alert.alertId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Runs the full surveillance pipeline: aggregate → detect → alert.
   * This is the method the EventBridge Lambda handler should call.
   *
   * Deduplication: accepts a set of recently-alerted keys (icd10Code+district)
   * to suppress duplicate alerts across consecutive cron runs. The Lambda handler
   * maintains this set in DynamoDB or a simple in-memory cache (TTL = time window).
   *
   * @param timeWindow Duration string for aggregation window
   * @param defaultThreshold Fallback threshold for conditions not in CONDITION_THRESHOLDS
   * @param recentlyAlerted Set of "icd10Code|district" keys already alerted — skip these
   * @returns Array of new OutbreakAlerts that were sent to the DHO
   */
  async runSurveillancePipeline(
    timeWindow: Duration,
    defaultThreshold: number,
    recentlyAlerted: Set<string> = new Set(),
  ): Promise<OutbreakAlert[]> {
    // Reset alert counter at the start of each pipeline run to prevent
    // cross-invocation leakage in warm Lambda containers (module-level state).
    _alertCounter = 0;

    // Step 1: Aggregate
    const aggregated = await this.aggregateByConditionAndLocation(timeWindow);

    if (aggregated.records.length === 0) {
      Logger.info('Surveillance pipeline: no records in time window', { timeWindow });
      return [];
    }

    // Step 2: Detect anomalies
    const allAlerts = this.detectAnomaly(aggregated, defaultThreshold);

    // Step 3: Deduplicate — skip alerts for condition+district+severity already notified.
    // The dedup key includes severity so that escalations (watch → alert → critical)
    // are NOT suppressed. Real-world scenario: dengue starts as "watch" (6 calls),
    // then escalates to "critical" (25 calls) — the DHO MUST be re-alerted.
    // The Lambda handler should store keys as "icd10Code|district|severity" in DynamoDB.
    const newAlerts = allAlerts.filter(alert => {
      const dedupeKey = `${alert.icd10Code}|${alert.location.district}|${alert.severity}`;
      // Also check legacy format (without severity) for backward compatibility
      const legacyKey = `${alert.icd10Code}|${alert.location.district}`;
      return !recentlyAlerted.has(dedupeKey) && !recentlyAlerted.has(legacyKey);
    });

    if (newAlerts.length < allAlerts.length) {
      Logger.info('Surveillance pipeline: suppressed duplicate alerts', {
        total: allAlerts.length,
        new: newAlerts.length,
        suppressed: allAlerts.length - newAlerts.length,
      });
    }

    // Step 4: Alert DHO for each new alert
    // Track notification failures so the Lambda handler can log/retry
    let failedNotifications = 0;
    for (const alert of newAlerts) {
      try {
        await this._notifier.publish(alert);
        Logger.info('DHO alert sent', {
          alertId: alert.alertId,
          icd10Code: alert.icd10Code,
          district: alert.location.district,
          village: alert.location.village,
          severity: alert.severity,
          callCount: alert.callCount,
        });
      } catch (err) {
        failedNotifications++;
        Logger.error('DHO alert failed in pipeline', {
          alertId: alert.alertId,
          icd10Code: alert.icd10Code,
          district: alert.location.district,
          severity: alert.severity,
          error: (err as Error).message,
        });
        // Continue — don't let one failed notification block others
      }
    }

    if (failedNotifications > 0) {
      Logger.error('Surveillance pipeline: some DHO notifications failed', {
        total: newAlerts.length,
        failed: failedNotifications,
        succeeded: newAlerts.length - failedNotifications,
      });
    }

    return newAlerts;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Classifies outbreak severity based on how far count exceeds threshold.
   *   - watch:    1x < count <= 2x
   *   - alert:    2x < count <= 3x
   *   - critical: count > 3x
   */
  private _classifySeverity(count: number, threshold: number): 'watch' | 'alert' | 'critical' {
    const ratio = count / threshold;
    if (ratio > 3) return 'critical';
    if (ratio > 2) return 'alert';
    return 'watch';
  }

  /**
   * Generates a unique alert ID using icd10Code, district, timestamp, and counter.
   * Avoids collisions even when multiple alerts are generated in the same millisecond.
   */
  private _generateAlertId(icd10Code: string, district: string): string {
    _alertCounter++;
    return `outbreak-${icd10Code}-${district}-${Date.now()}-${_alertCounter}`;
  }

  /**
   * Maps common ICD-10 codes to human-readable condition names.
   * Used in outbreak alerts for DHO readability.
   * Falls back to the raw ICD-10 code if not in the lookup.
   */
  private _icd10ToConditionName(icd10Code: string): string {
    const lookup: Record<string, string> = {
      'A90': 'Dengue Fever',
      'A09': 'Diarrhea / Gastroenteritis',
      'A01.0': 'Typhoid Fever',
      'A15': 'Tuberculosis',
      'A15.0': 'Tuberculosis (Respiratory)',
      'B54': 'Malaria',
      'J06.9': 'Acute Upper Respiratory Infection',
      'J45.9': 'Asthma',
      'I21.9': 'Acute Myocardial Infarction',
      'I64': 'Stroke',
      'T63.0': 'Snakebite',
      'R50.9': 'Fever (unspecified)',
      'E86.0': 'Dehydration',
      'E11': 'Type 2 Diabetes',
      'E11.9': 'Type 2 Diabetes (Unspecified)',
      'E10': 'Type 1 Diabetes',
      'I10': 'Hypertension',
      'R69': 'Unknown Condition',
    };
    return lookup[icd10Code] || icd10Code;
  }

  /**
   * Parses a Duration string into milliseconds.
   * Supports: m (minutes), h (hours), d (days), w (weeks).
   * Defaults to 3 days if unparseable.
   */
  private _parseDuration(duration: Duration): number {
    const match = duration.match(/^(\d+)(m|h|d|w)$/);
    if (!match) {
      Logger.warn('Unparseable surveillance duration, defaulting to 3d', { duration });
      return 3 * 24 * 60 * 60 * 1000;
    }

    const value = parseInt(match[1], 10);
    if (value === 0) {
      Logger.warn('Zero surveillance duration, defaulting to 3d', { duration });
      return 3 * 24 * 60 * 60 * 1000;
    }

    const unit = match[2];
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      default: return 3 * 24 * 60 * 60 * 1000;
    }
  }
}

/** Exported for testing — allows resetting the counter between test runs */
export function _resetAlertCounter(): void {
  _alertCounter = 0;
}

/** Exported for testing — allows inspecting condition thresholds */
export { CONDITION_THRESHOLDS };
