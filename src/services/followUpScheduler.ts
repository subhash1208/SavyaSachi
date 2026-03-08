import { Duration, ScheduleId, FollowUpPurpose } from '../models/enums';
import { FollowUpScheduleRecord } from '../models/types';
import { IFollowUpScheduler } from '../interfaces/IFollowUpScheduler';
import { Logger } from '../utils/logger';

// ─── EventBridge + DynamoDB client types for DI ──────────────────────────────

export interface IEventBridgeClient {
  putRule(params: {
    Name: string;
    ScheduleExpression: string;
    State: 'ENABLED' | 'DISABLED';
  }): Promise<void>;
  putTargets(params: {
    Rule: string;
    Targets: Array<{ Id: string; Arn: string; Input: string }>;
  }): Promise<void>;
  removeTargets(params: { Rule: string; Ids: string[] }): Promise<void>;
  deleteRule(params: { Name: string }): Promise<void>;
}

export interface IScheduleRepository {
  save(schedule: FollowUpScheduleRecord): Promise<void>;
  get(scheduleId: string): Promise<FollowUpScheduleRecord | null>;
  delete(scheduleId: string): Promise<void>;
}

// ─── Follow-Up Scheduler ─────────────────────────────────────────────────────

/** Lambda ARN for follow-up trigger — injected via environment variable */
const FOLLOW_UP_LAMBDA_ARN = process.env.FOLLOW_UP_LAMBDA_ARN ?? 'arn:aws:lambda:ap-south-1:000000000000:function:vaidyavaani-follow-up-trigger';

export class FollowUpSchedulerService implements IFollowUpScheduler {

  /** Monotonic counter to prevent scheduleId collision when two calls
   *  are processed in the same millisecond (e.g., Lambda warm container reuse). */
  private _counter = 0;

  constructor(
    private readonly _eventBridge: IEventBridgeClient,
    private readonly _scheduleRepo: IScheduleRepository,
  ) {}

  /**
   * Schedules a follow-up callback using EventBridge.
   * Creates a one-time rule that fires at the computed time.
   *
   * Real-world scenario: A child with diarrhea is triaged as non-urgent with
   * home care (ORS). A 2-hour follow-up is scheduled. If the mother doesn't
   * answer or reports worsening, the system escalates to urgent.
   *
   * Req 7.2: Schedule callback at appropriate interval using EventBridge.
   * Req 7.3: Trigger outbound call to check status.
   */
  async scheduleFollowUp(callId: string, interval: Duration, purpose: FollowUpPurpose): Promise<ScheduleId> {
    const scheduleId = `followup-${callId}-${Date.now()}-${this._counter++}`;
    // EventBridge rule names have a 64-character limit.
    // Twilio SIDs can be 34 chars, making the full name ~80+ chars.
    // Truncate to 64 chars to prevent putRule failures.
    const ruleName = `vv-fu-${scheduleId}`.substring(0, 64);
    const scheduledAt = this._computeScheduledTime(interval);

    try {
      // Create EventBridge rule with cron expression for one-time fire
      const cronExpr = this._toCronExpression(scheduledAt);
      await this._eventBridge.putRule({
        Name: ruleName,
        ScheduleExpression: cronExpr,
        State: 'ENABLED',
      });

      // Attach Lambda target
      // Target IDs also have a 64-char limit — truncate to be safe
      const targetId = `tgt-${scheduleId}`.substring(0, 64);
      await this._eventBridge.putTargets({
        Rule: ruleName,
        Targets: [{
          Id: targetId,
          Arn: FOLLOW_UP_LAMBDA_ARN,
          Input: JSON.stringify({ scheduleId, callId, purpose }),
        }],
      });

      // Persist schedule record in DynamoDB
      await this._scheduleRepo.save({
        scheduleId,
        callId,
        interval,
        purpose,
        ruleName,
        scheduledAt: scheduledAt.toISOString(),
        createdAt: new Date().toISOString(),
        status: 'active',
      });

      Logger.info('Follow-up scheduled', { scheduleId, callId, interval, purpose });
      return scheduleId;
    } catch (err) {
      // Schedule failure should not crash the call — log and return empty ID
      Logger.error('Failed to schedule follow-up', {
        callId,
        error: (err as Error).message,
      });
      return '';
    }
  }

  /**
   * Triggers a follow-up callback. Called by EventBridge when the rule fires.
   * Marks the schedule as triggered in DynamoDB.
   *
   * Req 7.3: Initiate outbound call to check status.
   */
  async triggerFollowUp(scheduleId: ScheduleId): Promise<void> {
    try {
      const record = await this._scheduleRepo.get(scheduleId);
      if (!record || record.status !== 'active') {
        Logger.warn('Follow-up trigger skipped — not active', { scheduleId });
        return;
      }

      // Mark as triggered
      await this._scheduleRepo.save({ ...record, status: 'triggered' });

      // Clean up EventBridge rule (one-time, no longer needed)
      await this._cleanupRule(record.ruleName, scheduleId);

      Logger.info('Follow-up triggered', { scheduleId, callId: record.callId });
      // Actual outbound call initiation is handled by the call handler (Task 16)
    } catch (err) {
      Logger.error('Follow-up trigger failed', {
        scheduleId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Cancels a scheduled follow-up. Removes EventBridge rule and marks cancelled.
   *
   * Used when: patient calls back before the follow-up fires, or emergency
   * escalation makes the follow-up unnecessary.
   */
  async cancelFollowUp(scheduleId: ScheduleId): Promise<void> {
    try {
      const record = await this._scheduleRepo.get(scheduleId);
      if (!record) {
        Logger.warn('Cancel skipped — schedule not found', { scheduleId });
        return;
      }

      // Only cancel active schedules — triggered/cancelled are terminal states
      if (record.status !== 'active') {
        Logger.warn('Cancel skipped — schedule not active', { scheduleId, status: record.status });
        return;
      }

      // Clean up EventBridge rule
      await this._cleanupRule(record.ruleName, scheduleId);

      // Mark as cancelled in DynamoDB
      await this._scheduleRepo.save({ ...record, status: 'cancelled' });

      Logger.info('Follow-up cancelled', { scheduleId });
    } catch (err) {
      Logger.error('Follow-up cancel failed', {
        scheduleId,
        error: (err as Error).message,
      });
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Parses a Duration string (e.g., "2h", "24h", "1w") into a future Date.
   */
  _computeScheduledTime(interval: Duration): Date {
    const now = new Date();
    const match = interval.match(/^(\d+)(m|h|d|w)$/);
    if (!match) {
      // Default to 24 hours if interval is unparseable
      Logger.warn('Unparseable interval, defaulting to 24h', { interval });
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    // Guard against zero-duration — clinically meaningless, default to 24h
    if (value === 0) {
      Logger.warn('Zero-duration interval, defaulting to 24h', { interval });
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    const msMultiplier: Record<string, number> = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
    };

    return new Date(now.getTime() + value * msMultiplier[unit]);
  }

  /**
   * Converts a Date to an EventBridge cron expression for one-time execution.
   * Format: cron(min hour day month ? year)
   */
  private _toCronExpression(date: Date): string {
    const min = date.getUTCMinutes();
    const hour = date.getUTCHours();
    const day = date.getUTCDate();
    const month = date.getUTCMonth() + 1;
    const year = date.getUTCFullYear();
    return `cron(${min} ${hour} ${day} ${month} ? ${year})`;
  }

  private async _cleanupRule(ruleName: string, scheduleId: string): Promise<void> {
    try {
      // Target ID must match what was used in putTargets — same truncation logic
      const targetId = `tgt-${scheduleId}`.substring(0, 64);
      await this._eventBridge.removeTargets({
        Rule: ruleName,
        Ids: [targetId],
      });
      await this._eventBridge.deleteRule({ Name: ruleName });
    } catch (err) {
      // Cleanup failure is non-critical — EventBridge rules with past dates are inert
      Logger.warn('EventBridge rule cleanup failed', { ruleName, error: (err as Error).message });
    }
  }
}
