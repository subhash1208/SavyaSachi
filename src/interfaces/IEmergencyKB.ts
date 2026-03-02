import { EmergencyScript, ABCDEScript } from '../models/types';
import { EmergencyCondition } from '../models/enums';

export interface IEmergencyKB {
  retrieveEmergencyScript(condition: EmergencyCondition, patientCategory: string): Promise<EmergencyScript>;
  getABCDEAssessment(condition: EmergencyCondition, patientCategory: string): Promise<ABCDEScript>;
}
