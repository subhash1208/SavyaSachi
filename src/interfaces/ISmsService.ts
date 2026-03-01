import { TriageResult, Hospital } from '../models/types';

export interface ISmsService {
  sendTriageSummary(phoneNumber: string, triageResult: TriageResult): Promise<void>;
  sendEmergencyInfo(phoneNumber: string, hospitals: Hospital[]): Promise<void>;
}
