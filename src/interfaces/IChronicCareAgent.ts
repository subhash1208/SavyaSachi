import { CallRecord, ChronicCareEnrollment } from '../models/types';
import { ChronicCondition } from '../models/enums';

export interface IChronicCareAgent {
  enrollPatient(callRecord: CallRecord, condition: ChronicCondition): Promise<ChronicCareEnrollment>;
  getMonitoringChecklist(condition: ChronicCondition): string[];
}
