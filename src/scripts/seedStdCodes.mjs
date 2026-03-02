/**
 * One-time seed script: populate vaidyavaani-std-codes DynamoDB table.
 * Run from CloudShell: node seedStdCodes.mjs
 * Data is IDENTICAL to src/data/stdCodeDatabase.ts (static fallback).
 * Source: TRAI/DoT STD code directory (public domain).
 */
import { DynamoDBClient, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const TABLE = 'vaidyavaani-std-codes';

const STD_CODES = [
  // DELHI
  { stdCode: '011', city: 'New Delhi', state: 'Delhi', district: 'New Delhi', type: 'landline' },

  // MAHARASHTRA
  { stdCode: '022', city: 'Mumbai', state: 'Maharashtra', district: 'Mumbai', type: 'landline' },
  { stdCode: '020', city: 'Pune', state: 'Maharashtra', district: 'Pune', type: 'landline' },
  { stdCode: '0712', city: 'Nagpur', state: 'Maharashtra', district: 'Nagpur', type: 'landline' },
  { stdCode: '0240', city: 'Aurangabad', state: 'Maharashtra', district: 'Aurangabad', type: 'landline' },
  { stdCode: '0233', city: 'Sangli', state: 'Maharashtra', district: 'Sangli', type: 'landline' },
  { stdCode: '0231', city: 'Kolhapur', state: 'Maharashtra', district: 'Kolhapur', type: 'landline' },
  { stdCode: '0253', city: 'Nashik', state: 'Maharashtra', district: 'Nashik', type: 'landline' },
  { stdCode: '0251', city: 'Thane', state: 'Maharashtra', district: 'Thane', type: 'landline' },
  { stdCode: '02162', city: 'Solapur', state: 'Maharashtra', district: 'Solapur', type: 'landline' },
  { stdCode: '07152', city: 'Amravati', state: 'Maharashtra', district: 'Amravati', type: 'landline' },
  { stdCode: '02352', city: 'Dhule', state: 'Maharashtra', district: 'Dhule', type: 'landline' },
  { stdCode: '02462', city: 'Nanded', state: 'Maharashtra', district: 'Nanded', type: 'landline' },
  { stdCode: '02382', city: 'Latur', state: 'Maharashtra', district: 'Latur', type: 'landline' },

  // KARNATAKA
  { stdCode: '080', city: 'Bengaluru', state: 'Karnataka', district: 'Bengaluru Urban', type: 'landline' },
  { stdCode: '0821', city: 'Mysuru', state: 'Karnataka', district: 'Mysuru', type: 'landline' },
  { stdCode: '0836', city: 'Hubballi', state: 'Karnataka', district: 'Dharwad', type: 'landline' },
  { stdCode: '0824', city: 'Mangaluru', state: 'Karnataka', district: 'Dakshina Kannada', type: 'landline' },
  { stdCode: '08472', city: 'Kalaburagi', state: 'Karnataka', district: 'Kalaburagi', type: 'landline' },
  { stdCode: '08352', city: 'Belagavi', state: 'Karnataka', district: 'Belagavi', type: 'landline' },
  { stdCode: '08192', city: 'Tumakuru', state: 'Karnataka', district: 'Tumakuru', type: 'landline' },
  { stdCode: '08232', city: 'Shivamogga', state: 'Karnataka', district: 'Shivamogga', type: 'landline' },
  { stdCode: '08262', city: 'Davanagere', state: 'Karnataka', district: 'Davanagere', type: 'landline' },
  { stdCode: '08532', city: 'Vijayapura', state: 'Karnataka', district: 'Vijayapura', type: 'landline' },

  // TAMIL NADU
  { stdCode: '044', city: 'Chennai', state: 'Tamil Nadu', district: 'Chennai', type: 'landline' },
  { stdCode: '0422', city: 'Coimbatore', state: 'Tamil Nadu', district: 'Coimbatore', type: 'landline' },
  { stdCode: '0452', city: 'Madurai', state: 'Tamil Nadu', district: 'Madurai', type: 'landline' },
  { stdCode: '0431', city: 'Tiruchirappalli', state: 'Tamil Nadu', district: 'Tiruchirappalli', type: 'landline' },
  { stdCode: '0416', city: 'Vellore', state: 'Tamil Nadu', district: 'Vellore', type: 'landline' },
  { stdCode: '04132', city: 'Tirunelveli', state: 'Tamil Nadu', district: 'Tirunelveli', type: 'landline' },
  { stdCode: '04562', city: 'Thanjavur', state: 'Tamil Nadu', district: 'Thanjavur', type: 'landline' },
  { stdCode: '04144', city: 'Salem', state: 'Tamil Nadu', district: 'Salem', type: 'landline' },
  { stdCode: '04632', city: 'Tiruppur', state: 'Tamil Nadu', district: 'Tiruppur', type: 'landline' },
  { stdCode: '04652', city: 'Erode', state: 'Tamil Nadu', district: 'Erode', type: 'landline' },

  // ANDHRA PRADESH
  { stdCode: '0866', city: 'Vijayawada', state: 'Andhra Pradesh', district: 'Krishna', type: 'landline' },
  { stdCode: '0891', city: 'Visakhapatnam', state: 'Andhra Pradesh', district: 'Visakhapatnam', type: 'landline' },
  { stdCode: '0861', city: 'Tirupati', state: 'Andhra Pradesh', district: 'Chittoor', type: 'landline' },
  { stdCode: '08562', city: 'Guntur', state: 'Andhra Pradesh', district: 'Guntur', type: 'landline' },
  { stdCode: '08942', city: 'Kakinada', state: 'Andhra Pradesh', district: 'East Godavari', type: 'landline' },
  { stdCode: '08812', city: 'Nellore', state: 'Andhra Pradesh', district: 'SPSR Nellore', type: 'landline' },
  { stdCode: '08514', city: 'Kurnool', state: 'Andhra Pradesh', district: 'Kurnool', type: 'landline' },
  { stdCode: '08572', city: 'Ongole', state: 'Andhra Pradesh', district: 'Prakasam', type: 'landline' },

  // TELANGANA
  { stdCode: '040', city: 'Hyderabad', state: 'Telangana', district: 'Hyderabad', type: 'landline' },
  { stdCode: '0870', city: 'Warangal', state: 'Telangana', district: 'Warangal', type: 'landline' },
  { stdCode: '08682', city: 'Nizamabad', state: 'Telangana', district: 'Nizamabad', type: 'landline' },
  { stdCode: '08542', city: 'Karimnagar', state: 'Telangana', district: 'Karimnagar', type: 'landline' },
  { stdCode: '08418', city: 'Khammam', state: 'Telangana', district: 'Khammam', type: 'landline' },

  // KERALA
  { stdCode: '0471', city: 'Thiruvananthapuram', state: 'Kerala', district: 'Thiruvananthapuram', type: 'landline' },
  { stdCode: '0484', city: 'Kochi', state: 'Kerala', district: 'Ernakulam', type: 'landline' },
  { stdCode: '0495', city: 'Kozhikode', state: 'Kerala', district: 'Kozhikode', type: 'landline' },
  { stdCode: '0481', city: 'Kottayam', state: 'Kerala', district: 'Kottayam', type: 'landline' },
  { stdCode: '0487', city: 'Thrissur', state: 'Kerala', district: 'Thrissur', type: 'landline' },
  { stdCode: '0491', city: 'Palakkad', state: 'Kerala', district: 'Palakkad', type: 'landline' },
  { stdCode: '0477', city: 'Alappuzha', state: 'Kerala', district: 'Alappuzha', type: 'landline' },
  { stdCode: '0497', city: 'Kannur', state: 'Kerala', district: 'Kannur', type: 'landline' },
  { stdCode: '04936', city: 'Malappuram', state: 'Kerala', district: 'Malappuram', type: 'landline' },
  { stdCode: '0474', city: 'Kollam', state: 'Kerala', district: 'Kollam', type: 'landline' },

  // WEST BENGAL
  { stdCode: '033', city: 'Kolkata', state: 'West Bengal', district: 'Kolkata', type: 'landline' },
  { stdCode: '0342', city: 'Asansol', state: 'West Bengal', district: 'Paschim Bardhaman', type: 'landline' },
  { stdCode: '0341', city: 'Durgapur', state: 'West Bengal', district: 'Paschim Bardhaman', type: 'landline' },
  { stdCode: '0353', city: 'Siliguri', state: 'West Bengal', district: 'Darjeeling', type: 'landline' },
  { stdCode: '03212', city: 'Bardhaman', state: 'West Bengal', district: 'Purba Bardhaman', type: 'landline' },
  { stdCode: '03222', city: 'Haldia', state: 'West Bengal', district: 'Purba Medinipur', type: 'landline' },
  { stdCode: '03452', city: 'Malda', state: 'West Bengal', district: 'Malda', type: 'landline' },
  { stdCode: '03482', city: 'Murshidabad', state: 'West Bengal', district: 'Murshidabad', type: 'landline' },

  // GUJARAT
  { stdCode: '079', city: 'Ahmedabad', state: 'Gujarat', district: 'Ahmedabad', type: 'landline' },
  { stdCode: '0265', city: 'Vadodara', state: 'Gujarat', district: 'Vadodara', type: 'landline' },
  { stdCode: '0261', city: 'Surat', state: 'Gujarat', district: 'Surat', type: 'landline' },
  { stdCode: '0281', city: 'Rajkot', state: 'Gujarat', district: 'Rajkot', type: 'landline' },
  { stdCode: '02692', city: 'Anand', state: 'Gujarat', district: 'Anand', type: 'landline' },
  { stdCode: '02762', city: 'Mehsana', state: 'Gujarat', district: 'Mehsana', type: 'landline' },
  { stdCode: '02832', city: 'Bhavnagar', state: 'Gujarat', district: 'Bhavnagar', type: 'landline' },
  { stdCode: '02752', city: 'Gandhinagar', state: 'Gujarat', district: 'Gandhinagar', type: 'landline' },
  { stdCode: '02522', city: 'Jamnagar', state: 'Gujarat', district: 'Jamnagar', type: 'landline' },
  { stdCode: '02962', city: 'Bhuj', state: 'Gujarat', district: 'Kutch', type: 'landline' },

  // RAJASTHAN
  { stdCode: '0141', city: 'Jaipur', state: 'Rajasthan', district: 'Jaipur', type: 'landline' },
  { stdCode: '0291', city: 'Jodhpur', state: 'Rajasthan', district: 'Jodhpur', type: 'landline' },
  { stdCode: '0294', city: 'Udaipur', state: 'Rajasthan', district: 'Udaipur', type: 'landline' },
  { stdCode: '0144', city: 'Ajmer', state: 'Rajasthan', district: 'Ajmer', type: 'landline' },
  { stdCode: '0744', city: 'Kota', state: 'Rajasthan', district: 'Kota', type: 'landline' },
  { stdCode: '01482', city: 'Bikaner', state: 'Rajasthan', district: 'Bikaner', type: 'landline' },
  { stdCode: '01412', city: 'Alwar', state: 'Rajasthan', district: 'Alwar', type: 'landline' },
  { stdCode: '01462', city: 'Bharatpur', state: 'Rajasthan', district: 'Bharatpur', type: 'landline' },
  { stdCode: '02932', city: 'Barmer', state: 'Rajasthan', district: 'Barmer', type: 'landline' },
  { stdCode: '01572', city: 'Sikar', state: 'Rajasthan', district: 'Sikar', type: 'landline' },

  // MADHYA PRADESH
  { stdCode: '0755', city: 'Bhopal', state: 'Madhya Pradesh', district: 'Bhopal', type: 'landline' },
  { stdCode: '0731', city: 'Indore', state: 'Madhya Pradesh', district: 'Indore', type: 'landline' },
  { stdCode: '0751', city: 'Gwalior', state: 'Madhya Pradesh', district: 'Gwalior', type: 'landline' },
  { stdCode: '0761', city: 'Jabalpur', state: 'Madhya Pradesh', district: 'Jabalpur', type: 'landline' },
  { stdCode: '07312', city: 'Ujjain', state: 'Madhya Pradesh', district: 'Ujjain', type: 'landline' },
  { stdCode: '07552', city: 'Sagar', state: 'Madhya Pradesh', district: 'Sagar', type: 'landline' },
  { stdCode: '07162', city: 'Rewa', state: 'Madhya Pradesh', district: 'Rewa', type: 'landline' },
  { stdCode: '07322', city: 'Dewas', state: 'Madhya Pradesh', district: 'Dewas', type: 'landline' },
  { stdCode: '07542', city: 'Vidisha', state: 'Madhya Pradesh', district: 'Vidisha', type: 'landline' },
  { stdCode: '07662', city: 'Satna', state: 'Madhya Pradesh', district: 'Satna', type: 'landline' },
  { stdCode: '07532', city: 'Morena', state: 'Madhya Pradesh', district: 'Morena', type: 'landline' },
  { stdCode: '07572', city: 'Raisen', state: 'Madhya Pradesh', district: 'Raisen', type: 'landline' },

  // UTTAR PRADESH
  { stdCode: '0522', city: 'Lucknow', state: 'Uttar Pradesh', district: 'Lucknow', type: 'landline' },
  { stdCode: '0532', city: 'Prayagraj', state: 'Uttar Pradesh', district: 'Prayagraj', type: 'landline' },
  { stdCode: '0542', city: 'Varanasi', state: 'Uttar Pradesh', district: 'Varanasi', type: 'landline' },
  { stdCode: '0571', city: 'Agra', state: 'Uttar Pradesh', district: 'Agra', type: 'landline' },
  { stdCode: '0581', city: 'Bareilly', state: 'Uttar Pradesh', district: 'Bareilly', type: 'landline' },
  { stdCode: '0551', city: 'Gorakhpur', state: 'Uttar Pradesh', district: 'Gorakhpur', type: 'landline' },
  { stdCode: '0121', city: 'Meerut', state: 'Uttar Pradesh', district: 'Meerut', type: 'landline' },
  { stdCode: '0562', city: 'Mathura', state: 'Uttar Pradesh', district: 'Mathura', type: 'landline' },
  { stdCode: '05922', city: 'Ayodhya', state: 'Uttar Pradesh', district: 'Ayodhya', type: 'landline' },
  { stdCode: '0515', city: 'Kanpur', state: 'Uttar Pradesh', district: 'Kanpur Nagar', type: 'landline' },
  { stdCode: '05842', city: 'Moradabad', state: 'Uttar Pradesh', district: 'Moradabad', type: 'landline' },
  { stdCode: '05672', city: 'Aligarh', state: 'Uttar Pradesh', district: 'Aligarh', type: 'landline' },
  { stdCode: '05412', city: 'Jhansi', state: 'Uttar Pradesh', district: 'Jhansi', type: 'landline' },
  { stdCode: '05192', city: 'Banda', state: 'Uttar Pradesh', district: 'Banda', type: 'landline' },
  { stdCode: '05612', city: 'Etawah', state: 'Uttar Pradesh', district: 'Etawah', type: 'landline' },

  // BIHAR
  { stdCode: '0612', city: 'Patna', state: 'Bihar', district: 'Patna', type: 'landline' },
  { stdCode: '0631', city: 'Gaya', state: 'Bihar', district: 'Gaya', type: 'landline' },
  { stdCode: '06182', city: 'Bhagalpur', state: 'Bihar', district: 'Bhagalpur', type: 'landline' },
  { stdCode: '06272', city: 'Muzaffarpur', state: 'Bihar', district: 'Muzaffarpur', type: 'landline' },
  { stdCode: '06452', city: 'Darbhanga', state: 'Bihar', district: 'Darbhanga', type: 'landline' },
  { stdCode: '06312', city: 'Aurangabad', state: 'Bihar', district: 'Aurangabad', type: 'landline' },
  { stdCode: '06154', city: 'Nalanda', state: 'Bihar', district: 'Nalanda', type: 'landline' },
  { stdCode: '06224', city: 'Samastipur', state: 'Bihar', district: 'Samastipur', type: 'landline' },

  // JHARKHAND
  { stdCode: '0651', city: 'Ranchi', state: 'Jharkhand', district: 'Ranchi', type: 'landline' },
  { stdCode: '0657', city: 'Jamshedpur', state: 'Jharkhand', district: 'East Singhbhum', type: 'landline' },
  { stdCode: '0326', city: 'Dhanbad', state: 'Jharkhand', district: 'Dhanbad', type: 'landline' },
  { stdCode: '06542', city: 'Hazaribagh', state: 'Jharkhand', district: 'Hazaribagh', type: 'landline' },
  { stdCode: '06522', city: 'Bokaro', state: 'Jharkhand', district: 'Bokaro', type: 'landline' },

  // ODISHA
  { stdCode: '0674', city: 'Bhubaneswar', state: 'Odisha', district: 'Khordha', type: 'landline' },
  { stdCode: '0671', city: 'Cuttack', state: 'Odisha', district: 'Cuttack', type: 'landline' },
  { stdCode: '0663', city: 'Rourkela', state: 'Odisha', district: 'Sundargarh', type: 'landline' },
  { stdCode: '06852', city: 'Sambalpur', state: 'Odisha', district: 'Sambalpur', type: 'landline' },
  { stdCode: '06782', city: 'Berhampur', state: 'Odisha', district: 'Ganjam', type: 'landline' },
  { stdCode: '06764', city: 'Puri', state: 'Odisha', district: 'Puri', type: 'landline' },

  // CHHATTISGARH
  { stdCode: '0771', city: 'Raipur', state: 'Chhattisgarh', district: 'Raipur', type: 'landline' },
  { stdCode: '0788', city: 'Bilaspur', state: 'Chhattisgarh', district: 'Bilaspur', type: 'landline' },
  { stdCode: '07752', city: 'Durg', state: 'Chhattisgarh', district: 'Durg', type: 'landline' },
  { stdCode: '07782', city: 'Korba', state: 'Chhattisgarh', district: 'Korba', type: 'landline' },
  { stdCode: '07712', city: 'Rajnandgaon', state: 'Chhattisgarh', district: 'Rajnandgaon', type: 'landline' },

  // PUNJAB
  { stdCode: '0172', city: 'Chandigarh', state: 'Punjab', district: 'Chandigarh', type: 'landline' },
  { stdCode: '0161', city: 'Ludhiana', state: 'Punjab', district: 'Ludhiana', type: 'landline' },
  { stdCode: '0183', city: 'Amritsar', state: 'Punjab', district: 'Amritsar', type: 'landline' },
  { stdCode: '0181', city: 'Jalandhar', state: 'Punjab', district: 'Jalandhar', type: 'landline' },
  { stdCode: '01762', city: 'Patiala', state: 'Punjab', district: 'Patiala', type: 'landline' },
  { stdCode: '01642', city: 'Bathinda', state: 'Punjab', district: 'Bathinda', type: 'landline' },
  { stdCode: '01722', city: 'Mohali', state: 'Punjab', district: 'SAS Nagar', type: 'landline' },

  // HARYANA
  { stdCode: '0124', city: 'Gurugram', state: 'Haryana', district: 'Gurugram', type: 'landline' },
  { stdCode: '0129', city: 'Faridabad', state: 'Haryana', district: 'Faridabad', type: 'landline' },
  { stdCode: '01662', city: 'Hisar', state: 'Haryana', district: 'Hisar', type: 'landline' },
  { stdCode: '01262', city: 'Rohtak', state: 'Haryana', district: 'Rohtak', type: 'landline' },
  { stdCode: '01744', city: 'Ambala', state: 'Haryana', district: 'Ambala', type: 'landline' },
  { stdCode: '01682', city: 'Sirsa', state: 'Haryana', district: 'Sirsa', type: 'landline' },
  { stdCode: '01274', city: 'Panipat', state: 'Haryana', district: 'Panipat', type: 'landline' },
  { stdCode: '01282', city: 'Sonipat', state: 'Haryana', district: 'Sonipat', type: 'landline' },
  { stdCode: '01664', city: 'Fatehabad', state: 'Haryana', district: 'Fatehabad', type: 'landline' },

  // HIMACHAL PRADESH
  { stdCode: '0177', city: 'Shimla', state: 'Himachal Pradesh', district: 'Shimla', type: 'landline' },
  { stdCode: '01892', city: 'Dharamshala', state: 'Himachal Pradesh', district: 'Kangra', type: 'landline' },
  { stdCode: '01972', city: 'Mandi', state: 'Himachal Pradesh', district: 'Mandi', type: 'landline' },
  { stdCode: '01902', city: 'Kullu', state: 'Himachal Pradesh', district: 'Kullu', type: 'landline' },

  // UTTARAKHAND
  { stdCode: '0135', city: 'Dehradun', state: 'Uttarakhand', district: 'Dehradun', type: 'landline' },
  { stdCode: '05946', city: 'Haridwar', state: 'Uttarakhand', district: 'Haridwar', type: 'landline' },
  { stdCode: '0594', city: 'Roorkee', state: 'Uttarakhand', district: 'Haridwar', type: 'landline' },
  { stdCode: '05942', city: 'Rishikesh', state: 'Uttarakhand', district: 'Dehradun', type: 'landline' },
  { stdCode: '05962', city: 'Nainital', state: 'Uttarakhand', district: 'Nainital', type: 'landline' },
  { stdCode: '05966', city: 'Haldwani', state: 'Uttarakhand', district: 'Nainital', type: 'landline' },

  // ASSAM
  { stdCode: '0361', city: 'Guwahati', state: 'Assam', district: 'Kamrup Metropolitan', type: 'landline' },
  { stdCode: '03712', city: 'Dibrugarh', state: 'Assam', district: 'Dibrugarh', type: 'landline' },
  { stdCode: '03672', city: 'Jorhat', state: 'Assam', district: 'Jorhat', type: 'landline' },
  { stdCode: '03842', city: 'Silchar', state: 'Assam', district: 'Cachar', type: 'landline' },
  { stdCode: '03612', city: 'Dispur', state: 'Assam', district: 'Kamrup Metropolitan', type: 'landline' },

  // NORTHEAST STATES
  { stdCode: '0385', city: 'Imphal', state: 'Manipur', district: 'Imphal West', type: 'landline' },
  { stdCode: '0364', city: 'Shillong', state: 'Meghalaya', district: 'East Khasi Hills', type: 'landline' },
  { stdCode: '0370', city: 'Kohima', state: 'Nagaland', district: 'Kohima', type: 'landline' },
  { stdCode: '0389', city: 'Aizawl', state: 'Mizoram', district: 'Aizawl', type: 'landline' },
  { stdCode: '03782', city: 'Agartala', state: 'Tripura', district: 'West Tripura', type: 'landline' },
  { stdCode: '03592', city: 'Gangtok', state: 'Sikkim', district: 'East Sikkim', type: 'landline' },
  { stdCode: '0360', city: 'Itanagar', state: 'Arunachal Pradesh', district: 'Papum Pare', type: 'landline' },

  // GOA
  { stdCode: '0832', city: 'Panaji', state: 'Goa', district: 'North Goa', type: 'landline' },
  { stdCode: '08322', city: 'Margao', state: 'Goa', district: 'South Goa', type: 'landline' },

  // JAMMU & KASHMIR / LADAKH
  { stdCode: '0191', city: 'Jammu', state: 'Jammu & Kashmir', district: 'Jammu', type: 'landline' },
  { stdCode: '0194', city: 'Srinagar', state: 'Jammu & Kashmir', district: 'Srinagar', type: 'landline' },
  { stdCode: '01982', city: 'Leh', state: 'Ladakh', district: 'Leh', type: 'landline' },
  { stdCode: '01985', city: 'Kargil', state: 'Ladakh', district: 'Kargil', type: 'landline' },

  // UNION TERRITORIES
  { stdCode: '0413', city: 'Puducherry', state: 'Puducherry', district: 'Puducherry', type: 'landline' },
  { stdCode: '03192', city: 'Port Blair', state: 'Andaman & Nicobar Islands', district: 'South Andaman', type: 'landline' },
];

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function seed() {
  const batches = chunk(STD_CODES, 25);
  let total = 0;
  for (const batch of batches) {
    const requestItems = {
      [TABLE]: batch.map(item => ({ PutRequest: { Item: marshall(item) } }))
    };
    await client.send(new BatchWriteItemCommand({ RequestItems: requestItems }));
    total += batch.length;
    console.log(`Seeded ${total}/${STD_CODES.length} STD codes...`);
  }
  console.log(`Done. ${STD_CODES.length} items written to ${TABLE}`);
}

seed().catch(console.error);
