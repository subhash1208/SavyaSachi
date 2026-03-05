import { EmergencyData, LocationData, DispatchResult, BilingualInstruction } from '../models/types';

export interface IEmergencyDispatch {
  executeLayer1(emergency: EmergencyData, location: LocationData): Promise<DispatchResult>;
  executeLayer2(emergency: EmergencyData, location: LocationData): Promise<DispatchResult>;
  executeLayer3(emergency: EmergencyData, location: LocationData): Promise<DispatchResult>;
  executeFullDispatch(emergency: EmergencyData, location: LocationData): Promise<DispatchResult>;
  bridgeTo108(callId: string, assessmentSummary: string): Promise<void>;
  buildAcceptanceMessage(hospitalName: string, estimatedArrival: string): BilingualInstruction;
}
