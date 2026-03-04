import { LocationData, Facility, FacilityCapabilities } from '../models/types';
import { FacilityLevel } from '../models/enums';

export interface IReferralAgent {
  findNearestFacility(location: LocationData, requiredLevel: FacilityLevel): Promise<Facility>;
  getFacilityCapabilities(facilityId: string): Promise<FacilityCapabilities>;
}
