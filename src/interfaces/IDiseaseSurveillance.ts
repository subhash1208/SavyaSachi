import { AggregatedData, OutbreakAlert } from '../models/types';
import { Duration } from '../models/enums';

export interface IDiseaseSurveillance {
  aggregateByConditionAndLocation(timeWindow: Duration): Promise<AggregatedData>;
  detectAnomaly(aggregatedData: AggregatedData, threshold: number): OutbreakAlert[];
  alertDHO(alert: OutbreakAlert): Promise<void>;
}
