import { LocationData, PatientSummary, MonitoringChecklist } from '../models/types';
import { ChronicCondition } from '../models/enums';

export interface IASHAWorkerAgent {
  alertASHAWorker(location: LocationData, patientDetails: PatientSummary): Promise<void>;
  assignChronicCare(patientId: string, condition: ChronicCondition, ashaWorkerId: string): Promise<void>;
  sendMonitoringChecklist(ashaWorkerId: string, checklist: MonitoringChecklist): Promise<void>;
}
