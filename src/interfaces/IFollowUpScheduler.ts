import { Duration, ScheduleId, FollowUpPurpose } from '../models/enums';

export interface IFollowUpScheduler {
  scheduleFollowUp(callId: string, interval: Duration, purpose: FollowUpPurpose): Promise<ScheduleId>;
  triggerFollowUp(scheduleId: ScheduleId): Promise<void>;
  cancelFollowUp(scheduleId: ScheduleId): Promise<void>;
}
