import { EmergencyData, LocationData, DispatchResult } from '../models/types';

export interface IEmergencyDispatch {
  executeLayer1(emergency: EmergencyData, location: LocationData): Promise<DispatchResult>;
  executeLayer2(emergency: EmergencyData, location: LocationData): Promise<DispatchResult>;
  executeLayer3(emergency: EmergencyData, location: LocationData): Promise<DispatchResult>;
  bridgeTo108(callId: string, assessmentSummary: string): Promise<void>;
}
