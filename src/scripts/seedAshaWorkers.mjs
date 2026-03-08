/**
 * Seed script: ASHA Worker records for DynamoDB
 *
 * Table: vaidyavaani-asha-workers
 * PK: district (String)
 * SK: ashaWorkerId (String)
 * GSI: village-index (PK: village) — for village-level lookup
 *
 * Run from CloudShell:
 *   node seedAshaWorkers.mjs
 *
 * Req 11.1: ASHA worker lookup by district/village for chronic care assignment.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-south-1' }));
const TABLE = 'vaidyavaani-asha-workers';

const ASHA_WORKERS = [
  // Madhya Pradesh — Vidisha district
  {
    ashaWorkerId: 'asha-mp-vid-001',
    name: 'Sunita Devi',
    phone: '+917554001001',
    village: 'khedi',          // normalized lowercase for lookup
    block: 'Vidisha Block',
    district: 'Vidisha',
    state: 'Madhya Pradesh',
  },
  {
    ashaWorkerId: 'asha-mp-vid-002',
    name: 'Meena Kumari',
    phone: '+917554001002',
    village: 'gyaraspur',
    block: 'Gyaraspur Block',
    district: 'Vidisha',
    state: 'Madhya Pradesh',
  },

  // Madhya Pradesh — Bhopal district
  {
    ashaWorkerId: 'asha-mp-bpl-001',
    name: 'Rekha Sharma',
    phone: '+917554002001',
    village: 'berasia',
    block: 'Berasia Block',
    district: 'Bhopal',
    state: 'Madhya Pradesh',
  },
  {
    ashaWorkerId: 'asha-mp-bpl-002',
    name: 'Anita Patel',
    phone: '+917554002002',
    village: 'phanda',
    block: 'Phanda Block',
    district: 'Bhopal',
    state: 'Madhya Pradesh',
  },

  // Madhya Pradesh — Sehore district
  {
    ashaWorkerId: 'asha-mp-seh-001',
    name: 'Kavita Yadav',
    phone: '+917554003001',
    village: 'ashta',
    block: 'Ashta Block',
    district: 'Sehore',
    state: 'Madhya Pradesh',
  },

  // Uttar Pradesh — Lucknow district
  {
    ashaWorkerId: 'asha-up-lko-001',
    name: 'Pushpa Singh',
    phone: '+915224001001',
    village: 'malihabad',
    block: 'Malihabad Block',
    district: 'Lucknow',
    state: 'Uttar Pradesh',
  },

  // Rajasthan — Jaipur district
  {
    ashaWorkerId: 'asha-rj-jai-001',
    name: 'Geeta Meena',
    phone: '+911414001001',
    village: 'sanganer',
    block: 'Sanganer Block',
    district: 'Jaipur',
    state: 'Rajasthan',
  },

  // Bihar — Patna district
  {
    ashaWorkerId: 'asha-br-pat-001',
    name: 'Savita Devi',
    phone: '+916124001001',
    village: 'phulwari',
    block: 'Phulwari Block',
    district: 'Patna',
    state: 'Bihar',
  },
];

async function seed() {
  console.log(`Seeding ${ASHA_WORKERS.length} ASHA worker records to ${TABLE}...`);

  for (let i = 0; i < ASHA_WORKERS.length; i++) {
    const worker = ASHA_WORKERS[i];
    await client.send(new PutCommand({
      TableName: TABLE,
      Item: worker,
    }));
    console.log(`[${i + 1}/${ASHA_WORKERS.length}] Seeded: ${worker.name} / ${worker.district} / ${worker.village}`);
  }

  console.log('Done.');
}

seed().catch(console.error);
