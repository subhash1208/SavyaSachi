import { DrugInfo, PatientProfile } from '../models/types';
import { DrugQueryType } from '../models/enums';

export interface IDrugKB {
  queryDrug(drugName: string, queryType: DrugQueryType, patientProfile: PatientProfile): Promise<DrugInfo>;
  checkOverdose(drugName: string): boolean;
}
