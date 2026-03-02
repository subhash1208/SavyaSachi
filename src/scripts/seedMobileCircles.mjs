/**
 * One-time seed script: populate vaidyavaani-mobile-circles DynamoDB table.
 * Run from CloudShell: node seedMobileCircles.mjs
 * Source: TRAI Mobile Number Series Allocation (public domain)
 * prefix4 = first 4 digits of a 10-digit Indian mobile number.
 * All prefix4 values are UNIQUE — no duplicates.
 * Note: Post-MNP, operator may differ but state/circle is still reliable.
 */
import { DynamoDBClient, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const TABLE = 'vaidyavaani-mobile-circles';

const MOBILE_CIRCLES = [
  // DELHI
  { prefix4: '9810', state: 'Delhi', circle: 'Delhi', operator: 'Airtel' },
  { prefix4: '9811', state: 'Delhi', circle: 'Delhi', operator: 'Vodafone' },
  { prefix4: '9818', state: 'Delhi', circle: 'Delhi', operator: 'Airtel' },
  { prefix4: '9871', state: 'Delhi', circle: 'Delhi', operator: 'Airtel' },
  { prefix4: '9999', state: 'Delhi', circle: 'Delhi', operator: 'Airtel' },
  { prefix4: '9958', state: 'Delhi', circle: 'Delhi', operator: 'Vodafone' },
  { prefix4: '9312', state: 'Delhi', circle: 'Delhi', operator: 'Vodafone' },
  { prefix4: '9313', state: 'Delhi', circle: 'Delhi', operator: 'Vodafone' },
  { prefix4: '9891', state: 'Delhi', circle: 'Delhi', operator: 'Idea' },
  { prefix4: '7011', state: 'Delhi', circle: 'Delhi', operator: 'Jio' },
  { prefix4: '7012', state: 'Delhi', circle: 'Delhi', operator: 'Jio' },
  { prefix4: '8800', state: 'Delhi', circle: 'Delhi', operator: 'Jio' },
  { prefix4: '8826', state: 'Delhi', circle: 'Delhi', operator: 'Jio' },
  { prefix4: '9650', state: 'Delhi', circle: 'Delhi', operator: 'BSNL' },

  // MAHARASHTRA - MUMBAI CIRCLE
  { prefix4: '9820', state: 'Maharashtra', circle: 'Mumbai', operator: 'Vodafone' },
  { prefix4: '9821', state: 'Maharashtra', circle: 'Mumbai', operator: 'Vodafone' },
  { prefix4: '9833', state: 'Maharashtra', circle: 'Mumbai', operator: 'Vodafone' },
  { prefix4: '9867', state: 'Maharashtra', circle: 'Mumbai', operator: 'Airtel' },
  { prefix4: '9869', state: 'Maharashtra', circle: 'Mumbai', operator: 'Airtel' },
  { prefix4: '9892', state: 'Maharashtra', circle: 'Mumbai', operator: 'Idea' },
  { prefix4: '7208', state: 'Maharashtra', circle: 'Mumbai', operator: 'Jio' },
  { prefix4: '8108', state: 'Maharashtra', circle: 'Mumbai', operator: 'Jio' },

  // MAHARASHTRA - REST OF MAHARASHTRA CIRCLE
  { prefix4: '9422', state: 'Maharashtra', circle: 'Maharashtra', operator: 'Airtel' },
  { prefix4: '9423', state: 'Maharashtra', circle: 'Maharashtra', operator: 'Airtel' },
  { prefix4: '9421', state: 'Maharashtra', circle: 'Maharashtra', operator: 'BSNL' },
  { prefix4: '7718', state: 'Maharashtra', circle: 'Maharashtra', operator: 'Jio' },
  { prefix4: '8308', state: 'Maharashtra', circle: 'Maharashtra', operator: 'Jio' },

  // KARNATAKA
  { prefix4: '9845', state: 'Karnataka', circle: 'Karnataka', operator: 'Airtel' },
  { prefix4: '9886', state: 'Karnataka', circle: 'Karnataka', operator: 'Airtel' },
  { prefix4: '9880', state: 'Karnataka', circle: 'Karnataka', operator: 'Vodafone' },
  { prefix4: '9900', state: 'Karnataka', circle: 'Karnataka', operator: 'Vodafone' },
  { prefix4: '9448', state: 'Karnataka', circle: 'Karnataka', operator: 'BSNL' },
  { prefix4: '7019', state: 'Karnataka', circle: 'Karnataka', operator: 'Jio' },
  { prefix4: '8861', state: 'Karnataka', circle: 'Karnataka', operator: 'Jio' },
  { prefix4: '6360', state: 'Karnataka', circle: 'Karnataka', operator: 'Jio' },

  // TAMIL NADU
  { prefix4: '9840', state: 'Tamil Nadu', circle: 'Tamil Nadu', operator: 'Airtel' },
  { prefix4: '9841', state: 'Tamil Nadu', circle: 'Tamil Nadu', operator: 'Airtel' },
  { prefix4: '9894', state: 'Tamil Nadu', circle: 'Tamil Nadu', operator: 'Airtel' },
  { prefix4: '9884', state: 'Tamil Nadu', circle: 'Tamil Nadu', operator: 'Vodafone' },
  { prefix4: '9443', state: 'Tamil Nadu', circle: 'Tamil Nadu', operator: 'BSNL' },
  { prefix4: '7200', state: 'Tamil Nadu', circle: 'Tamil Nadu', operator: 'Jio' },
  { prefix4: '8056', state: 'Tamil Nadu', circle: 'Tamil Nadu', operator: 'Jio' },
  { prefix4: '6374', state: 'Tamil Nadu', circle: 'Tamil Nadu', operator: 'Jio' },

  // ANDHRA PRADESH
  { prefix4: '9390', state: 'Andhra Pradesh', circle: 'Andhra Pradesh', operator: 'Airtel' },
  { prefix4: '9391', state: 'Andhra Pradesh', circle: 'Andhra Pradesh', operator: 'Airtel' },
  { prefix4: '9392', state: 'Andhra Pradesh', circle: 'Andhra Pradesh', operator: 'Airtel' },
  { prefix4: '9440', state: 'Andhra Pradesh', circle: 'Andhra Pradesh', operator: 'BSNL' },
  { prefix4: '7207', state: 'Andhra Pradesh', circle: 'Andhra Pradesh', operator: 'Jio' },
  { prefix4: '8008', state: 'Andhra Pradesh', circle: 'Andhra Pradesh', operator: 'Jio' },

  // TELANGANA
  { prefix4: '9849', state: 'Telangana', circle: 'Andhra Pradesh', operator: 'Vodafone' },
  { prefix4: '9848', state: 'Telangana', circle: 'Andhra Pradesh', operator: 'Vodafone' },
  { prefix4: '9346', state: 'Telangana', circle: 'Andhra Pradesh', operator: 'Airtel' },
  { prefix4: '6302', state: 'Telangana', circle: 'Andhra Pradesh', operator: 'Jio' },

  // KERALA
  { prefix4: '9447', state: 'Kerala', circle: 'Kerala', operator: 'BSNL' },
  { prefix4: '9446', state: 'Kerala', circle: 'Kerala', operator: 'BSNL' },
  { prefix4: '9895', state: 'Kerala', circle: 'Kerala', operator: 'Airtel' },
  { prefix4: '9847', state: 'Kerala', circle: 'Kerala', operator: 'Vodafone' },
  { prefix4: '9496', state: 'Kerala', circle: 'Kerala', operator: 'Idea' },
  { prefix4: '7025', state: 'Kerala', circle: 'Kerala', operator: 'Jio' },
  { prefix4: '8086', state: 'Kerala', circle: 'Kerala', operator: 'Jio' },
  { prefix4: '6238', state: 'Kerala', circle: 'Kerala', operator: 'Jio' },

  // WEST BENGAL
  { prefix4: '9830', state: 'West Bengal', circle: 'West Bengal', operator: 'Vodafone' },
  { prefix4: '9831', state: 'West Bengal', circle: 'West Bengal', operator: 'Vodafone' },
  { prefix4: '9832', state: 'West Bengal', circle: 'West Bengal', operator: 'Airtel' },
  { prefix4: '9836', state: 'West Bengal', circle: 'West Bengal', operator: 'Airtel' },
  { prefix4: '9434', state: 'West Bengal', circle: 'West Bengal', operator: 'BSNL' },
  { prefix4: '7001', state: 'West Bengal', circle: 'West Bengal', operator: 'Jio' },
  { prefix4: '8017', state: 'West Bengal', circle: 'West Bengal', operator: 'Jio' },

  // GUJARAT
  { prefix4: '9825', state: 'Gujarat', circle: 'Gujarat', operator: 'Airtel' },
  { prefix4: '9824', state: 'Gujarat', circle: 'Gujarat', operator: 'Vodafone' },
  { prefix4: '9898', state: 'Gujarat', circle: 'Gujarat', operator: 'Vodafone' },
  { prefix4: '9426', state: 'Gujarat', circle: 'Gujarat', operator: 'BSNL' },
  { prefix4: '7016', state: 'Gujarat', circle: 'Gujarat', operator: 'Jio' },
  { prefix4: '8160', state: 'Gujarat', circle: 'Gujarat', operator: 'Jio' },
  { prefix4: '6353', state: 'Gujarat', circle: 'Gujarat', operator: 'Jio' },

  // RAJASTHAN
  { prefix4: '9829', state: 'Rajasthan', circle: 'Rajasthan', operator: 'Airtel' },
  { prefix4: '9828', state: 'Rajasthan', circle: 'Rajasthan', operator: 'Airtel' },
  { prefix4: '9414', state: 'Rajasthan', circle: 'Rajasthan', operator: 'BSNL' },
  { prefix4: '9928', state: 'Rajasthan', circle: 'Rajasthan', operator: 'Vodafone' },
  { prefix4: '7014', state: 'Rajasthan', circle: 'Rajasthan', operator: 'Jio' },
  { prefix4: '8209', state: 'Rajasthan', circle: 'Rajasthan', operator: 'Jio' },

  // MADHYA PRADESH
  { prefix4: '9826', state: 'Madhya Pradesh', circle: 'Madhya Pradesh', operator: 'Airtel' },
  { prefix4: '9993', state: 'Madhya Pradesh', circle: 'Madhya Pradesh', operator: 'Airtel' },
  { prefix4: '9425', state: 'Madhya Pradesh', circle: 'Madhya Pradesh', operator: 'BSNL' },
  { prefix4: '9977', state: 'Madhya Pradesh', circle: 'Madhya Pradesh', operator: 'Vodafone' },
  { prefix4: '7049', state: 'Madhya Pradesh', circle: 'Madhya Pradesh', operator: 'Jio' },
  { prefix4: '8109', state: 'Madhya Pradesh', circle: 'Madhya Pradesh', operator: 'Jio' },

  // CHHATTISGARH (separate circle from MP)
  { prefix4: '9827', state: 'Chhattisgarh', circle: 'Madhya Pradesh', operator: 'Airtel' },
  { prefix4: '9407', state: 'Chhattisgarh', circle: 'Madhya Pradesh', operator: 'BSNL' },
  { prefix4: '7587', state: 'Chhattisgarh', circle: 'Madhya Pradesh', operator: 'Jio' },

  // UTTAR PRADESH EAST
  { prefix4: '9839', state: 'Uttar Pradesh', circle: 'UP East', operator: 'Airtel' },
  { prefix4: '9838', state: 'Uttar Pradesh', circle: 'UP East', operator: 'Airtel' },
  { prefix4: '9415', state: 'Uttar Pradesh', circle: 'UP East', operator: 'BSNL' },
  { prefix4: '9450', state: 'Uttar Pradesh', circle: 'UP East', operator: 'BSNL' },
  { prefix4: '7007', state: 'Uttar Pradesh', circle: 'UP East', operator: 'Jio' },
  { prefix4: '8318', state: 'Uttar Pradesh', circle: 'UP East', operator: 'Jio' },

  // UTTAR PRADESH WEST
  { prefix4: '9837', state: 'Uttar Pradesh', circle: 'UP West', operator: 'Airtel' },
  { prefix4: '9412', state: 'Uttar Pradesh', circle: 'UP West', operator: 'BSNL' },
  { prefix4: '9719', state: 'Uttar Pradesh', circle: 'UP West', operator: 'Vodafone' },
  { prefix4: '7060', state: 'Uttar Pradesh', circle: 'UP West', operator: 'Jio' },
  { prefix4: '8057', state: 'Uttar Pradesh', circle: 'UP West', operator: 'Jio' },

  // BIHAR & JHARKHAND
  { prefix4: '9835', state: 'Bihar', circle: 'Bihar', operator: 'Airtel' },
  { prefix4: '9334', state: 'Bihar', circle: 'Bihar', operator: 'Vodafone' },
  { prefix4: '9431', state: 'Bihar', circle: 'Bihar', operator: 'BSNL' },
  { prefix4: '7004', state: 'Bihar', circle: 'Bihar', operator: 'Jio' },
  { prefix4: '8051', state: 'Jharkhand', circle: 'Bihar', operator: 'Jio' },
  { prefix4: '9771', state: 'Bihar', circle: 'Bihar', operator: 'Airtel' },
  { prefix4: '8986', state: 'Jharkhand', circle: 'Bihar', operator: 'Airtel' },

  // PUNJAB
  { prefix4: '9815', state: 'Punjab', circle: 'Punjab', operator: 'Airtel' },
  { prefix4: '9814', state: 'Punjab', circle: 'Punjab', operator: 'Airtel' },
  { prefix4: '9417', state: 'Punjab', circle: 'Punjab', operator: 'BSNL' },
  { prefix4: '9872', state: 'Punjab', circle: 'Punjab', operator: 'Vodafone' },
  { prefix4: '7087', state: 'Punjab', circle: 'Punjab', operator: 'Jio' },
  { prefix4: '8054', state: 'Punjab', circle: 'Punjab', operator: 'Jio' },

  // HARYANA
  { prefix4: '9812', state: 'Haryana', circle: 'Haryana', operator: 'Airtel' },
  { prefix4: '9416', state: 'Haryana', circle: 'Haryana', operator: 'BSNL' },
  { prefix4: '9896', state: 'Haryana', circle: 'Haryana', operator: 'Vodafone' },
  { prefix4: '7015', state: 'Haryana', circle: 'Haryana', operator: 'Jio' },
  { prefix4: '8295', state: 'Haryana', circle: 'Haryana', operator: 'Jio' },

  // HIMACHAL PRADESH
  { prefix4: '9816', state: 'Himachal Pradesh', circle: 'Himachal Pradesh', operator: 'Airtel' },
  { prefix4: '9418', state: 'Himachal Pradesh', circle: 'Himachal Pradesh', operator: 'BSNL' },
  { prefix4: '9805', state: 'Himachal Pradesh', circle: 'Himachal Pradesh', operator: 'Vodafone' },
  { prefix4: '7018', state: 'Himachal Pradesh', circle: 'Himachal Pradesh', operator: 'Jio' },

  // UTTARAKHAND
  { prefix4: '9411', state: 'Uttarakhand', circle: 'UP West', operator: 'BSNL' },
  { prefix4: '9456', state: 'Uttarakhand', circle: 'UP West', operator: 'Airtel' },
  { prefix4: '7055', state: 'Uttarakhand', circle: 'UP West', operator: 'Jio' },

  // ODISHA
  { prefix4: '9861', state: 'Odisha', circle: 'Odisha', operator: 'Airtel' },
  { prefix4: '9437', state: 'Odisha', circle: 'Odisha', operator: 'BSNL' },
  { prefix4: '9938', state: 'Odisha', circle: 'Odisha', operator: 'Vodafone' },
  { prefix4: '7008', state: 'Odisha', circle: 'Odisha', operator: 'Jio' },
  { prefix4: '8249', state: 'Odisha', circle: 'Odisha', operator: 'Jio' },

  // ASSAM & NORTHEAST
  { prefix4: '9435', state: 'Assam', circle: 'Assam', operator: 'BSNL' },
  { prefix4: '9864', state: 'Assam', circle: 'Assam', operator: 'Airtel' },
  { prefix4: '9706', state: 'Assam', circle: 'Assam', operator: 'Vodafone' },
  { prefix4: '7002', state: 'Assam', circle: 'Assam', operator: 'Jio' },
  { prefix4: '6000', state: 'Assam', circle: 'Assam', operator: 'Jio' },
  { prefix4: '9436', state: 'Manipur', circle: 'North East', operator: 'BSNL' },
  { prefix4: '9862', state: 'Arunachal Pradesh', circle: 'North East', operator: 'Airtel' },
  { prefix4: '9863', state: 'Meghalaya', circle: 'North East', operator: 'Airtel' },
  { prefix4: '9856', state: 'Mizoram', circle: 'North East', operator: 'Airtel' },
  { prefix4: '9402', state: 'Nagaland', circle: 'North East', operator: 'BSNL' },
  { prefix4: '9774', state: 'Tripura', circle: 'North East', operator: 'Airtel' },
  { prefix4: '7085', state: 'North East', circle: 'North East', operator: 'Jio' },

  // JAMMU & KASHMIR / LADAKH
  { prefix4: '9419', state: 'Jammu & Kashmir', circle: 'Jammu & Kashmir', operator: 'BSNL' },
  { prefix4: '9906', state: 'Jammu & Kashmir', circle: 'Jammu & Kashmir', operator: 'Airtel' },
  { prefix4: '7006', state: 'Jammu & Kashmir', circle: 'Jammu & Kashmir', operator: 'Jio' },
  { prefix4: '9596', state: 'Jammu & Kashmir', circle: 'Jammu & Kashmir', operator: 'Vodafone' },

  // GOA
  { prefix4: '9822', state: 'Goa', circle: 'Maharashtra', operator: 'Vodafone' },
  { prefix4: '9823', state: 'Goa', circle: 'Maharashtra', operator: 'Airtel' },

  // ANDAMAN & NICOBAR
  { prefix4: '9474', state: 'Andaman & Nicobar Islands', circle: 'Andaman & Nicobar', operator: 'BSNL' },
];

// Validate no duplicate prefix4 values before seeding
const prefixes = MOBILE_CIRCLES.map(e => e.prefix4 || e.stdCode);
const duplicates = prefixes.filter((p, i) => prefixes.indexOf(p) !== i);
if (duplicates.length > 0) {
  console.error('DUPLICATE prefix4 values found:', duplicates);
  process.exit(1);
}

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function seed() {
  // Normalize: use prefix4 field consistently
  const normalized = MOBILE_CIRCLES.map(e => ({
    prefix4: e.prefix4 || e.stdCode,
    state: e.state,
    circle: e.circle,
    operator: e.operator,
  }));

  const batches = chunk(normalized, 25);
  let total = 0;
  for (const batch of batches) {
    const requestItems = {
      [TABLE]: batch.map(item => ({ PutRequest: { Item: marshall(item) } }))
    };
    await client.send(new BatchWriteItemCommand({ RequestItems: requestItems }));
    total += batch.length;
    console.log(`Seeded ${total}/${normalized.length} mobile prefixes...`);
  }
  console.log(`Done. ${normalized.length} items written to ${TABLE}`);
}

seed().catch(console.error);
