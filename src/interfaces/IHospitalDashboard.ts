import { Hospital, EmergencyData, AcceptanceConfirmation, LocationData } from '../models/types';

export interface IHospitalDashboard {
  blastNotification(hospitals: Hospital[], emergency: EmergencyData): Promise<void>;
  acceptPatient(hospitalId: string, emergencyId: string): Promise<AcceptanceConfirmation>;
  getHospitalsInRadius(location: LocationData, radiusKm: number): Promise<Hospital[]>;
}
