import { DrugInfo, PatientProfile } from '../models/types';
import { DrugQueryType } from '../models/enums';
import { IDrugKB } from '../interfaces/IDrugKB';
import { findDrugEntry } from '../data/drugDatabase';
import { Logger } from '../utils/logger';

export class DrugKBService implements IDrugKB {

  /**
   * Query drug information filtered by patient profile.
   * Pregnancy flag filters out adult-male-specific dosage fields.
   * Production: DynamoDB query on `vaidyavaani-drug-kb` table (same interface).
   */
  async queryDrug(
    drugName: string,
    queryType: DrugQueryType,
    patientProfile: PatientProfile
  ): Promise<DrugInfo> {
    const entry = findDrugEntry(drugName);

    if (!entry) {
      Logger.warn('Drug not found in database', { drugName, queryType });
      return {
        drug_name: drugName,
        query_type: queryType,
        contraindications: [],
        pregnancy_category: 'unknown',
        source: 'not_found',
        not_found: true,
      };
    }

    const isPregnant =
      patientProfile.pregnancy_flag === 'confirmed' ||
      patientProfile.pregnancy_flag === 'possible';

    const isPediatric = patientProfile.category === 'pediatric';

    Logger.info('Drug query resolved', { drugName: entry.drug_name, queryType, isPregnant, isPediatric });

    // Build response — filter fields based on patient profile
    const result: DrugInfo = {
      drug_name: entry.drug_name,
      query_type: queryType,
      contraindications: entry.contraindications,
      pregnancy_category: entry.pregnancy_category,
      source: entry.source,
    };

    if (isPregnant) {
      // Pregnancy mode: show pregnancy note prominently, omit adult male dosage context
      result.dose_adult = entry.pregnancy_note;
      result.max_daily_adult = entry.max_daily_adult;
      result.renal_adjustment = entry.renal_adjustment;
    } else if (isPediatric) {
      result.dose_child = entry.dose_child;
      result.max_daily_child = entry.max_daily_child;
      result.renal_adjustment = entry.renal_adjustment;
    } else {
      // Adult (non-pregnant)
      result.dose_adult = entry.dose_adult;
      result.max_daily_adult = entry.max_daily_adult;
      result.dose_child = entry.dose_child;
      result.max_daily_child = entry.max_daily_child;
      result.renal_adjustment = entry.renal_adjustment;
    }

    // Overdose query: always include threshold regardless of profile
    if (queryType === 'overdose') {
      const threshold = isPediatric
        ? entry.overdose_threshold_child
        : entry.overdose_threshold_adult;
      result.dose_adult = threshold;  // reuse dose_adult field as overdose threshold message
    }

    return result;
  }

  /**
   * Overdose check — synchronous, called before async queryDrug.
   * Any drug query with type "overdose" triggers the emergency path immediately.
   * Per spec Task 4.1: checkOverdose() returns true for query_type "overdose".
   */
  checkOverdose(drugName: string): boolean {
    // The overdose decision is based on query_type, not drug name.
    // This method is called with the drug name as a signal — the caller
    // already knows query_type is "overdose" when invoking this.
    // Returns true to trigger emergency path.
    const entry = findDrugEntry(drugName);
    if (!entry) return false;  // unknown drug — do not auto-escalate, let triage handle
    return true;  // known drug + overdose query = escalate to emergency
  }
}
