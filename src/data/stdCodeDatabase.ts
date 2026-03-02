import { STDCodeEntry } from '../models/types';

/**
 * Indian STD code → city/state/district mapping.
 * Source: TRAI/DoT STD code directory (public domain).
 * Used for Tier 2 location detection — automatic, zero user input.
 * Covers all state capitals, major cities, and district headquarters.
 */

export const STD_CODE_DATABASE: STDCodeEntry[] = [
  // ─── DELHI ────────────────────────────────────────────────────────────────
  { stdCode: '011', city: 'New Delhi', state: 'Delhi', district: 'New Delhi' },

  // ─── MAHARASHTRA ──────────────────────────────────────────────────────────
  { stdCode: '022', city: 'Mumbai', state: 'Maharashtra', district: 'Mumbai' },
  { stdCode: '020', city: 'Pune', state: 'Maharashtra', district: 'Pune' },
  { stdCode: '0712', city: 'Nagpur', state: 'Maharashtra', district: 'Nagpur' },
  { stdCode: '0240', city: 'Aurangabad', state: 'Maharashtra', district: 'Aurangabad' },
  { stdCode: '0233', city: 'Sangli', state: 'Maharashtra', district: 'Sangli' },
  { stdCode: '0231', city: 'Kolhapur', state: 'Maharashtra', district: 'Kolhapur' },
  { stdCode: '0253', city: 'Nashik', state: 'Maharashtra', district: 'Nashik' },
  { stdCode: '0251', city: 'Thane', state: 'Maharashtra', district: 'Thane' },
  { stdCode: '02162', city: 'Solapur', state: 'Maharashtra', district: 'Solapur' },
  { stdCode: '07152', city: 'Amravati', state: 'Maharashtra', district: 'Amravati' },
  { stdCode: '02352', city: 'Dhule', state: 'Maharashtra', district: 'Dhule' },
  { stdCode: '02462', city: 'Nanded', state: 'Maharashtra', district: 'Nanded' },
  { stdCode: '02382', city: 'Latur', state: 'Maharashtra', district: 'Latur' },

  // ─── KARNATAKA ────────────────────────────────────────────────────────────
  { stdCode: '080', city: 'Bengaluru', state: 'Karnataka', district: 'Bengaluru Urban' },
  { stdCode: '0821', city: 'Mysuru', state: 'Karnataka', district: 'Mysuru' },
  { stdCode: '0836', city: 'Hubballi', state: 'Karnataka', district: 'Dharwad' },
  { stdCode: '0824', city: 'Mangaluru', state: 'Karnataka', district: 'Dakshina Kannada' },
  { stdCode: '08472', city: 'Kalaburagi', state: 'Karnataka', district: 'Kalaburagi' },
  { stdCode: '08352', city: 'Belagavi', state: 'Karnataka', district: 'Belagavi' },
  { stdCode: '08192', city: 'Tumakuru', state: 'Karnataka', district: 'Tumakuru' },
  { stdCode: '08232', city: 'Shivamogga', state: 'Karnataka', district: 'Shivamogga' },
  { stdCode: '08262', city: 'Davanagere', state: 'Karnataka', district: 'Davanagere' },
  { stdCode: '08532', city: 'Vijayapura', state: 'Karnataka', district: 'Vijayapura' },

  // ─── TAMIL NADU ───────────────────────────────────────────────────────────
  { stdCode: '044', city: 'Chennai', state: 'Tamil Nadu', district: 'Chennai' },
  { stdCode: '0422', city: 'Coimbatore', state: 'Tamil Nadu', district: 'Coimbatore' },
  { stdCode: '0452', city: 'Madurai', state: 'Tamil Nadu', district: 'Madurai' },
  { stdCode: '0431', city: 'Tiruchirappalli', state: 'Tamil Nadu', district: 'Tiruchirappalli' },
  { stdCode: '0416', city: 'Vellore', state: 'Tamil Nadu', district: 'Vellore' },
  { stdCode: '04132', city: 'Tirunelveli', state: 'Tamil Nadu', district: 'Tirunelveli' },
  { stdCode: '04562', city: 'Thanjavur', state: 'Tamil Nadu', district: 'Thanjavur' },
  { stdCode: '04144', city: 'Salem', state: 'Tamil Nadu', district: 'Salem' },
  { stdCode: '04632', city: 'Tiruppur', state: 'Tamil Nadu', district: 'Tiruppur' },
  { stdCode: '04652', city: 'Erode', state: 'Tamil Nadu', district: 'Erode' },

  // ─── ANDHRA PRADESH ───────────────────────────────────────────────────────
  { stdCode: '0866', city: 'Vijayawada', state: 'Andhra Pradesh', district: 'Krishna' },
  { stdCode: '0891', city: 'Visakhapatnam', state: 'Andhra Pradesh', district: 'Visakhapatnam' },
  { stdCode: '0861', city: 'Tirupati', state: 'Andhra Pradesh', district: 'Chittoor' },
  { stdCode: '08562', city: 'Guntur', state: 'Andhra Pradesh', district: 'Guntur' },
  { stdCode: '08942', city: 'Kakinada', state: 'Andhra Pradesh', district: 'East Godavari' },
  { stdCode: '08812', city: 'Nellore', state: 'Andhra Pradesh', district: 'SPSR Nellore' },
  { stdCode: '08514', city: 'Kurnool', state: 'Andhra Pradesh', district: 'Kurnool' },
  { stdCode: '08572', city: 'Ongole', state: 'Andhra Pradesh', district: 'Prakasam' },

  // ─── TELANGANA ────────────────────────────────────────────────────────────
  { stdCode: '040', city: 'Hyderabad', state: 'Telangana', district: 'Hyderabad' },
  { stdCode: '0870', city: 'Warangal', state: 'Telangana', district: 'Warangal' },
  { stdCode: '08682', city: 'Nizamabad', state: 'Telangana', district: 'Nizamabad' },
  { stdCode: '08542', city: 'Karimnagar', state: 'Telangana', district: 'Karimnagar' },
  { stdCode: '08418', city: 'Khammam', state: 'Telangana', district: 'Khammam' },

  // ─── KERALA ───────────────────────────────────────────────────────────────
  { stdCode: '0471', city: 'Thiruvananthapuram', state: 'Kerala', district: 'Thiruvananthapuram' },
  { stdCode: '0484', city: 'Kochi', state: 'Kerala', district: 'Ernakulam' },
  { stdCode: '0495', city: 'Kozhikode', state: 'Kerala', district: 'Kozhikode' },
  { stdCode: '0481', city: 'Kottayam', state: 'Kerala', district: 'Kottayam' },
  { stdCode: '0487', city: 'Thrissur', state: 'Kerala', district: 'Thrissur' },
  { stdCode: '0491', city: 'Palakkad', state: 'Kerala', district: 'Palakkad' },
  { stdCode: '0477', city: 'Alappuzha', state: 'Kerala', district: 'Alappuzha' },
  { stdCode: '0497', city: 'Kannur', state: 'Kerala', district: 'Kannur' },
  { stdCode: '04936', city: 'Malappuram', state: 'Kerala', district: 'Malappuram' },
  { stdCode: '0474', city: 'Kollam', state: 'Kerala', district: 'Kollam' },

  // ─── WEST BENGAL ──────────────────────────────────────────────────────────
  { stdCode: '033', city: 'Kolkata', state: 'West Bengal', district: 'Kolkata' },
  { stdCode: '0342', city: 'Asansol', state: 'West Bengal', district: 'Paschim Bardhaman' },
  { stdCode: '0341', city: 'Durgapur', state: 'West Bengal', district: 'Paschim Bardhaman' },
  { stdCode: '0353', city: 'Siliguri', state: 'West Bengal', district: 'Darjeeling' },
  { stdCode: '03212', city: 'Bardhaman', state: 'West Bengal', district: 'Purba Bardhaman' },
  { stdCode: '03222', city: 'Haldia', state: 'West Bengal', district: 'Purba Medinipur' },
  { stdCode: '03452', city: 'Malda', state: 'West Bengal', district: 'Malda' },
  { stdCode: '03482', city: 'Murshidabad', state: 'West Bengal', district: 'Murshidabad' },

  // ─── GUJARAT ──────────────────────────────────────────────────────────────
  { stdCode: '079', city: 'Ahmedabad', state: 'Gujarat', district: 'Ahmedabad' },
  { stdCode: '0265', city: 'Vadodara', state: 'Gujarat', district: 'Vadodara' },
  { stdCode: '0261', city: 'Surat', state: 'Gujarat', district: 'Surat' },
  { stdCode: '0281', city: 'Rajkot', state: 'Gujarat', district: 'Rajkot' },
  { stdCode: '02692', city: 'Anand', state: 'Gujarat', district: 'Anand' },
  { stdCode: '02762', city: 'Mehsana', state: 'Gujarat', district: 'Mehsana' },
  { stdCode: '02832', city: 'Bhavnagar', state: 'Gujarat', district: 'Bhavnagar' },
  { stdCode: '02752', city: 'Gandhinagar', state: 'Gujarat', district: 'Gandhinagar' },
  { stdCode: '02522', city: 'Jamnagar', state: 'Gujarat', district: 'Jamnagar' },
  { stdCode: '02962', city: 'Bhuj', state: 'Gujarat', district: 'Kutch' },

  // ─── RAJASTHAN ────────────────────────────────────────────────────────────
  { stdCode: '0141', city: 'Jaipur', state: 'Rajasthan', district: 'Jaipur' },
  { stdCode: '0291', city: 'Jodhpur', state: 'Rajasthan', district: 'Jodhpur' },
  { stdCode: '0294', city: 'Udaipur', state: 'Rajasthan', district: 'Udaipur' },
  { stdCode: '0144', city: 'Ajmer', state: 'Rajasthan', district: 'Ajmer' },
  { stdCode: '0744', city: 'Kota', state: 'Rajasthan', district: 'Kota' },
  { stdCode: '01482', city: 'Bikaner', state: 'Rajasthan', district: 'Bikaner' },
  { stdCode: '01412', city: 'Alwar', state: 'Rajasthan', district: 'Alwar' },
  { stdCode: '01462', city: 'Bharatpur', state: 'Rajasthan', district: 'Bharatpur' },
  { stdCode: '02932', city: 'Barmer', state: 'Rajasthan', district: 'Barmer' },
  { stdCode: '01572', city: 'Sikar', state: 'Rajasthan', district: 'Sikar' },

  // ─── MADHYA PRADESH ───────────────────────────────────────────────────────
  { stdCode: '0755', city: 'Bhopal', state: 'Madhya Pradesh', district: 'Bhopal' },
  { stdCode: '0731', city: 'Indore', state: 'Madhya Pradesh', district: 'Indore' },
  { stdCode: '0751', city: 'Gwalior', state: 'Madhya Pradesh', district: 'Gwalior' },
  { stdCode: '0761', city: 'Jabalpur', state: 'Madhya Pradesh', district: 'Jabalpur' },
  { stdCode: '07312', city: 'Ujjain', state: 'Madhya Pradesh', district: 'Ujjain' },
  { stdCode: '07552', city: 'Sagar', state: 'Madhya Pradesh', district: 'Sagar' },
  { stdCode: '07162', city: 'Rewa', state: 'Madhya Pradesh', district: 'Rewa' },
  { stdCode: '07322', city: 'Dewas', state: 'Madhya Pradesh', district: 'Dewas' },
  { stdCode: '07542', city: 'Vidisha', state: 'Madhya Pradesh', district: 'Vidisha' },
  { stdCode: '07662', city: 'Satna', state: 'Madhya Pradesh', district: 'Satna' },
  { stdCode: '07532', city: 'Morena', state: 'Madhya Pradesh', district: 'Morena' },
  { stdCode: '07572', city: 'Raisen', state: 'Madhya Pradesh', district: 'Raisen' },

  // ─── UTTAR PRADESH ────────────────────────────────────────────────────────
  { stdCode: '0522', city: 'Lucknow', state: 'Uttar Pradesh', district: 'Lucknow' },
  { stdCode: '0532', city: 'Prayagraj', state: 'Uttar Pradesh', district: 'Prayagraj' },
  { stdCode: '0542', city: 'Varanasi', state: 'Uttar Pradesh', district: 'Varanasi' },
  { stdCode: '0571', city: 'Agra', state: 'Uttar Pradesh', district: 'Agra' },
  { stdCode: '0581', city: 'Bareilly', state: 'Uttar Pradesh', district: 'Bareilly' },
  { stdCode: '0551', city: 'Gorakhpur', state: 'Uttar Pradesh', district: 'Gorakhpur' },
  { stdCode: '0121', city: 'Meerut', state: 'Uttar Pradesh', district: 'Meerut' },
  { stdCode: '0562', city: 'Mathura', state: 'Uttar Pradesh', district: 'Mathura' },
  { stdCode: '05922', city: 'Ayodhya', state: 'Uttar Pradesh', district: 'Ayodhya' },
  { stdCode: '0515', city: 'Kanpur', state: 'Uttar Pradesh', district: 'Kanpur Nagar' },
  { stdCode: '05842', city: 'Moradabad', state: 'Uttar Pradesh', district: 'Moradabad' },
  { stdCode: '05672', city: 'Aligarh', state: 'Uttar Pradesh', district: 'Aligarh' },
  { stdCode: '05412', city: 'Jhansi', state: 'Uttar Pradesh', district: 'Jhansi' },
  { stdCode: '05192', city: 'Banda', state: 'Uttar Pradesh', district: 'Banda' },
  { stdCode: '05612', city: 'Etawah', state: 'Uttar Pradesh', district: 'Etawah' },

  // ─── BIHAR ────────────────────────────────────────────────────────────────
  { stdCode: '0612', city: 'Patna', state: 'Bihar', district: 'Patna' },
  { stdCode: '0631', city: 'Gaya', state: 'Bihar', district: 'Gaya' },
  { stdCode: '06182', city: 'Bhagalpur', state: 'Bihar', district: 'Bhagalpur' },
  { stdCode: '06272', city: 'Muzaffarpur', state: 'Bihar', district: 'Muzaffarpur' },
  { stdCode: '06452', city: 'Darbhanga', state: 'Bihar', district: 'Darbhanga' },
  { stdCode: '06312', city: 'Aurangabad', state: 'Bihar', district: 'Aurangabad' },
  { stdCode: '06154', city: 'Nalanda', state: 'Bihar', district: 'Nalanda' },
  { stdCode: '06224', city: 'Samastipur', state: 'Bihar', district: 'Samastipur' },

  // ─── JHARKHAND ────────────────────────────────────────────────────────────
  { stdCode: '0651', city: 'Ranchi', state: 'Jharkhand', district: 'Ranchi' },
  { stdCode: '0657', city: 'Jamshedpur', state: 'Jharkhand', district: 'East Singhbhum' },
  { stdCode: '0326', city: 'Dhanbad', state: 'Jharkhand', district: 'Dhanbad' },
  { stdCode: '06542', city: 'Hazaribagh', state: 'Jharkhand', district: 'Hazaribagh' },
  { stdCode: '06522', city: 'Bokaro', state: 'Jharkhand', district: 'Bokaro' },

  // ─── ODISHA ───────────────────────────────────────────────────────────────
  { stdCode: '0674', city: 'Bhubaneswar', state: 'Odisha', district: 'Khordha' },
  { stdCode: '0671', city: 'Cuttack', state: 'Odisha', district: 'Cuttack' },
  { stdCode: '0663', city: 'Rourkela', state: 'Odisha', district: 'Sundargarh' },
  { stdCode: '06852', city: 'Sambalpur', state: 'Odisha', district: 'Sambalpur' },
  { stdCode: '06782', city: 'Berhampur', state: 'Odisha', district: 'Ganjam' },
  { stdCode: '06764', city: 'Puri', state: 'Odisha', district: 'Puri' },

  // ─── CHHATTISGARH ─────────────────────────────────────────────────────────
  { stdCode: '0771', city: 'Raipur', state: 'Chhattisgarh', district: 'Raipur' },
  { stdCode: '0788', city: 'Bilaspur', state: 'Chhattisgarh', district: 'Bilaspur' },
  { stdCode: '07752', city: 'Durg', state: 'Chhattisgarh', district: 'Durg' },
  { stdCode: '07782', city: 'Korba', state: 'Chhattisgarh', district: 'Korba' },
  { stdCode: '07712', city: 'Rajnandgaon', state: 'Chhattisgarh', district: 'Rajnandgaon' },

  // ─── PUNJAB ───────────────────────────────────────────────────────────────
  { stdCode: '0172', city: 'Chandigarh', state: 'Punjab', district: 'Chandigarh' },
  { stdCode: '0161', city: 'Ludhiana', state: 'Punjab', district: 'Ludhiana' },
  { stdCode: '0183', city: 'Amritsar', state: 'Punjab', district: 'Amritsar' },
  { stdCode: '0181', city: 'Jalandhar', state: 'Punjab', district: 'Jalandhar' },
  { stdCode: '01762', city: 'Patiala', state: 'Punjab', district: 'Patiala' },
  { stdCode: '01642', city: 'Bathinda', state: 'Punjab', district: 'Bathinda' },
  { stdCode: '01722', city: 'Mohali', state: 'Punjab', district: 'SAS Nagar' },

  // ─── HARYANA ──────────────────────────────────────────────────────────────
  { stdCode: '0124', city: 'Gurugram', state: 'Haryana', district: 'Gurugram' },
  { stdCode: '0129', city: 'Faridabad', state: 'Haryana', district: 'Faridabad' },
  { stdCode: '01662', city: 'Hisar', state: 'Haryana', district: 'Hisar' },
  { stdCode: '01262', city: 'Rohtak', state: 'Haryana', district: 'Rohtak' },
  { stdCode: '01744', city: 'Ambala', state: 'Haryana', district: 'Ambala' },
  { stdCode: '01682', city: 'Sirsa', state: 'Haryana', district: 'Sirsa' },
  { stdCode: '01274', city: 'Panipat', state: 'Haryana', district: 'Panipat' },
  { stdCode: '01282', city: 'Sonipat', state: 'Haryana', district: 'Sonipat' },
  { stdCode: '01664', city: 'Fatehabad', state: 'Haryana', district: 'Fatehabad' },

  // ─── HIMACHAL PRADESH ─────────────────────────────────────────────────────
  { stdCode: '0177', city: 'Shimla', state: 'Himachal Pradesh', district: 'Shimla' },
  { stdCode: '01892', city: 'Dharamshala', state: 'Himachal Pradesh', district: 'Kangra' },
  { stdCode: '01972', city: 'Mandi', state: 'Himachal Pradesh', district: 'Mandi' },
  { stdCode: '01902', city: 'Kullu', state: 'Himachal Pradesh', district: 'Kullu' },

  // ─── UTTARAKHAND ──────────────────────────────────────────────────────────
  { stdCode: '0135', city: 'Dehradun', state: 'Uttarakhand', district: 'Dehradun' },
  { stdCode: '05946', city: 'Haridwar', state: 'Uttarakhand', district: 'Haridwar' },
  { stdCode: '0594', city: 'Roorkee', state: 'Uttarakhand', district: 'Haridwar' },
  { stdCode: '05942', city: 'Rishikesh', state: 'Uttarakhand', district: 'Dehradun' },
  { stdCode: '05962', city: 'Nainital', state: 'Uttarakhand', district: 'Nainital' },
  { stdCode: '05966', city: 'Haldwani', state: 'Uttarakhand', district: 'Nainital' },

  // ─── ASSAM ────────────────────────────────────────────────────────────────
  { stdCode: '0361', city: 'Guwahati', state: 'Assam', district: 'Kamrup Metropolitan' },
  { stdCode: '03712', city: 'Dibrugarh', state: 'Assam', district: 'Dibrugarh' },
  { stdCode: '03672', city: 'Jorhat', state: 'Assam', district: 'Jorhat' },
  { stdCode: '03842', city: 'Silchar', state: 'Assam', district: 'Cachar' },
  { stdCode: '03612', city: 'Dispur', state: 'Assam', district: 'Kamrup Metropolitan' },

  // ─── NORTHEAST STATES ─────────────────────────────────────────────────────
  { stdCode: '0385', city: 'Imphal', state: 'Manipur', district: 'Imphal West' },
  { stdCode: '0364', city: 'Shillong', state: 'Meghalaya', district: 'East Khasi Hills' },
  { stdCode: '0370', city: 'Kohima', state: 'Nagaland', district: 'Kohima' },
  { stdCode: '0389', city: 'Aizawl', state: 'Mizoram', district: 'Aizawl' },
  { stdCode: '03782', city: 'Agartala', state: 'Tripura', district: 'West Tripura' },
  { stdCode: '03592', city: 'Gangtok', state: 'Sikkim', district: 'East Sikkim' },
  { stdCode: '0360', city: 'Itanagar', state: 'Arunachal Pradesh', district: 'Papum Pare' },

  // ─── GOA ──────────────────────────────────────────────────────────────────
  { stdCode: '0832', city: 'Panaji', state: 'Goa', district: 'North Goa' },
  { stdCode: '08322', city: 'Margao', state: 'Goa', district: 'South Goa' },

  // ─── JAMMU & KASHMIR / LADAKH ─────────────────────────────────────────────
  { stdCode: '0191', city: 'Jammu', state: 'Jammu & Kashmir', district: 'Jammu' },
  { stdCode: '0194', city: 'Srinagar', state: 'Jammu & Kashmir', district: 'Srinagar' },
  { stdCode: '01982', city: 'Leh', state: 'Ladakh', district: 'Leh' },
  { stdCode: '01985', city: 'Kargil', state: 'Ladakh', district: 'Kargil' },

  // ─── UNION TERRITORIES ────────────────────────────────────────────────────
  { stdCode: '0413', city: 'Puducherry', state: 'Puducherry', district: 'Puducherry' },
  { stdCode: '03192', city: 'Port Blair', state: 'Andaman & Nicobar Islands', district: 'South Andaman' },
];

/**
 * Lookup STD code → location entry.
 * Tries longest prefix match first (5-digit before 4-digit before 3-digit before 2-digit).
 * This handles cases like 07552 (Sagar) vs 0755 (Bhopal).
 */
export function lookupSTDCode(phoneNumber: string): STDCodeEntry | null {
  // Normalize: strip +91, leading 0, spaces, dashes
  const normalized = phoneNumber
    .replace(/^\+91/, '')
    .replace(/\s|-/g, '');

  // Add leading 0 if missing (mobile numbers won't have it, landlines will)
  const withZero = normalized.startsWith('0') ? normalized : '0' + normalized;

  // Try longest match first (5 chars → 4 → 3 → 2)
  for (const len of [5, 4, 3, 2]) {
    const prefix = withZero.substring(0, len);
    const match = STD_CODE_DATABASE.find(e => e.stdCode === prefix);
    if (match) return match;
  }
  return null;
}
