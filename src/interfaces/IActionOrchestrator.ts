import { TriageResult, LocationData, ActionResults } from '../models/types';

export interface IActionOrchestrator {
  orchestrateActions(triageResult: TriageResult, location: LocationData): Promise<ActionResults>;
}
