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
      // Pregnancy mode: show pregnancy note prominently, omit adult male dosage context (Req 14.2)
      // Do NOT include max_daily_adult or renal_adjustment — these are adult-specific values
      // that could mislead Nova Pro into giving non-pregnancy-safe guidance.
      result.dose_adult = entry.pregnancy_note;
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
      result.overdose_threshold = threshold;  // dedicated field — dose_adult preserved for normal dose context
    }

    return result;
  }

  /**
   * Overdose check — synchronous, called before async queryDrug.
   * Any drug query with type "overdose" triggers the emergency path immediately.
   * Per spec Task 4.1: checkOverdose() returns true for query_type "overdose".
   */
  checkOverdose(drugName: string): boolean {
    // Any overdose mention = emergency, regardless of whether the drug is in our database.
    // The caller already knows query_type is "overdose" when invoking this.
    // Unknown drugs are equally dangerous — we can't assume "not in DB = safe".
    // The Intent Router also checks query_type === 'overdose' independently (Req 14.3),
    // but this method must be consistent: overdose = true, always.
    return true;
  }
}
