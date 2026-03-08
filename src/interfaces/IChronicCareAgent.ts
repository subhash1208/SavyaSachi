import { CallRecord, ChronicCareEnrollment, MonitoringChecklist } from '../models/types';
import { ChronicCondition } from '../models/enums';

export interface IChronicCareAgent {
  enrollPatient(callRecord: CallRecord, condition: ChronicCondition): Promise<ChronicCareEnrollment>;
  getMonitoringChecklist(condition: ChronicCondition): string[];
  /** Returns full checklist with frequency + alert thresholds — used by ASHAWorkerAgent */
  getFullChecklist(condition: ChronicCondition): MonitoringChecklist;
}
