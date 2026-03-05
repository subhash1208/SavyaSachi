import { Tier1Location, Tier2Location, ResolvedLocation } from '../models/types';

export interface ILocationDetector {
  extractSTDCode(phoneNumber: string): Promise<Tier2Location | null>;
  parseNovaLocation(locationMentioned: string | null): Tier1Location | null;
  parseVoiceLocation(transcribedText: string): Tier1Location | null;
  sendGPSLink(phoneNumber: string, callId?: string): Promise<void>;
  receiveGPSCoordinates(callId: string, lat: number, lng: number): Promise<{ latitude: number; longitude: number }>;
  resolveLocation(tier2: Tier2Location, tier1?: Tier1Location): ResolvedLocation;
}
