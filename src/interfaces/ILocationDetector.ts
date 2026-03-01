import { Tier1Location, Tier2Location, Tier3Location, ResolvedLocation } from '../models/types';

export interface ILocationDetector {
  extractSTDCode(phoneNumber: string): Tier2Location;
  parseVoiceLocation(transcribedText: string): Tier1Location | null;
  sendGPSLink(phoneNumber: string, callId: string): Promise<void>;
  receiveGPSCoordinates(callId: string, lat: number, lng: number): Tier3Location;
  resolveLocation(callId: string): Promise<ResolvedLocation>;
}
