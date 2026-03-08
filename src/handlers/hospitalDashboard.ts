/**
 * VaidyaVaani — Hospital Dashboard API Handler (Task 16.3)
 *
 * API Gateway handlers for the hospital-facing emergency notification system.
 * Two endpoints:
 *   POST /hospital/notify    — Emergency dispatch blasts a notification to nearby hospitals
 *   POST /hospital/accept    — Hospital accepts an emergency patient
 *   GET  /hospital/status    — Hospital polls for pending emergencies (dashboard polling)
 *
 * Flow:
 *   1. EmergencyDispatch calls /hospital/notify with EmergencyData + hospital list
 *   2. Hospital dashboard UI polls /hospital/status to see pending emergencies
 *   3. Hospital clicks "Accept" → POST /hospital/accept
 *   4. Acceptance is written to DynamoDB → EmergencyDispatch Layer 1 poll picks it up
 *   5. Caller is notified: "Hospital X ne accept kar liya, ambulance aa rahi hai"
 *
 * Req 5.1, 5.2
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { withErrorHandler } from '../middleware/errorHandler';
import { HospitalDashboardService } from '../services/hospitalDashboard';
import { EmergencyData, Hospital, AcceptanceConfirmation } from '../models/types';
import { Logger } from '../utils/logger';

// ─── DynamoDB table names ─────────────────────────────────────────────────────

const EMERGENCIES_TABLE = 'vaidyavaani-emergency-notifications';
const ACCEPTANCES_TABLE = 'vaidyavaani-emergency-acceptances';
const TTL_2_HOURS = 2 * 60 * 60; // seconds — emergencies auto-expire after 2h

// ─── DI types ─────────────────────────────────────────────────────────────────

export interface HospitalDashboardDeps {
  dashboard: HospitalDashboardService;
  dynamo: DynamoDBClient;
}

function createDefaultDeps(): HospitalDashboardDeps {
  return {
    dashboard: new HospitalDashboardService(),
    dynamo: new DynamoDBClient({ region: process.env.AWS_REGION ?? 'ap-south-1' }),
  };
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function parseBody<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─── POST /hospital/notify ────────────────────────────────────────────────────

/**
 * Called by EmergencyDispatchService to blast a notification to nearby hospitals.
 * Writes the emergency record to DynamoDB so hospital dashboards can poll it.
 *
 * Request body:
 *   { emergency: EmergencyData, hospitals: Hospital[] }
 *
 * Response:
 *   { notified: number, emergencyId: string }
 *
 * Real-world scenario: A cardiac patient calls from Bhopal. EmergencyDispatch
 * finds 3 hospitals within 30km and calls this endpoint. Each hospital's
 * dashboard (AWS Amplify web app) polls /hospital/status and shows the alert.
 *
 * Req 5.1: Blast notification to 3 nearest hospitals within 30km.
 */
async function handleNotify(
  event: APIGatewayProxyEvent,
  deps: HospitalDashboardDeps,
): Promise<APIGatewayProxyResult> {
  const body = parseBody<{ emergency: EmergencyData; hospitals: Hospital[] }>(event.body);

  if (!body?.emergency || !Array.isArray(body.hospitals)) {
    return jsonResponse(400, { error: 'Missing emergency or hospitals in request body' });
  }

  const { emergency, hospitals } = body;
  const ttl = Math.floor(Date.now() / 1000) + TTL_2_HOURS;

  // Write emergency record to DynamoDB — hospitals poll this
  try {
    await deps.dynamo.send(new PutItemCommand({
      TableName: EMERGENCIES_TABLE,
      Item: marshall({
        emergencyId: emergency.callId,
        callId: emergency.callId,
        condition: emergency.condition,
        icd10Code: emergency.icd10Code,
        abcdeSummary: emergency.abcdeSummary,
        location: emergency.location,
        callerNumber: '[REDACTED]',  // never expose caller number to hospital dashboard
        dispatchType: emergency.dispatchType,
        notifiedHospitalIds: hospitals.map(h => h.hospitalId),
        status: 'pending',
        createdAt: new Date().toISOString(),
        ttl,
      }, { removeUndefinedValues: true }),
    }));
  } catch (err) {
    Logger.error('Failed to write emergency notification to DynamoDB', {
      callId: emergency.callId,
      error: (err as Error).message,
    });
    return jsonResponse(500, { error: 'Failed to store emergency notification' });
  }

  // Blast to hospital dashboard service (logs + production HTTP calls)
  await deps.dashboard.blastNotification(hospitals, emergency);

  Logger.info('Emergency notification blasted', {
    callId: emergency.callId,
    condition: emergency.condition,
    hospitalCount: hospitals.length,
  });

  return jsonResponse(200, {
    notified: hospitals.length,
    emergencyId: emergency.callId,
  });
}

// ─── POST /hospital/accept ────────────────────────────────────────────────────

/**
 * Called when a hospital accepts an emergency patient via the dashboard UI.
 * Writes the acceptance to DynamoDB — EmergencyDispatch Layer 1 polls this.
 * Also updates the emergency record status to "accepted".
 *
 * Request body:
 *   { hospitalId: string, emergencyId: string, estimatedArrival?: string }
 *
 * Response:
 *   AcceptanceConfirmation
 *
 * Real-world scenario: Hamidia Hospital's duty doctor sees the cardiac alert
 * on the dashboard and clicks "Accept". This endpoint fires, writes the
 * acceptance to DynamoDB, and the EmergencyDispatch poll picks it up within
 * 5 seconds. The caller hears: "Hamidia Hospital ne accept kar liya."
 *
 * Req 5.2: Hospital accepts patient, caller is notified.
 */
async function handleAccept(
  event: APIGatewayProxyEvent,
  deps: HospitalDashboardDeps,
): Promise<APIGatewayProxyResult> {
  const body = parseBody<{ hospitalId: string; emergencyId: string; estimatedArrival?: string }>(event.body);

  if (!body?.hospitalId || !body?.emergencyId) {
    return jsonResponse(400, { error: 'Missing hospitalId or emergencyId' });
  }

  const { hospitalId, emergencyId, estimatedArrival = '15 minutes' } = body;

  // Record acceptance in DynamoDB
  const confirmation: AcceptanceConfirmation = {
    hospitalId,
    emergencyId,
    acceptedAt: new Date().toISOString(),
    estimatedArrival,
  };

  const ttl = Math.floor(Date.now() / 1000) + TTL_2_HOURS;

  try {
    // Write acceptance record — EmergencyDispatch polls this table
    await deps.dynamo.send(new PutItemCommand({
      TableName: ACCEPTANCES_TABLE,
      Item: marshall({ ...confirmation, ttl }, { removeUndefinedValues: true }),
    }));

    // Update emergency status to "accepted" so other hospitals stop seeing it
    await deps.dynamo.send(new UpdateItemCommand({
      TableName: EMERGENCIES_TABLE,
      Key: marshall({ emergencyId }),
      UpdateExpression: 'SET #s = :accepted, acceptedBy = :hospitalId, acceptedAt = :acceptedAt',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: marshall({
        ':accepted': 'accepted',
        ':hospitalId': hospitalId,
        ':acceptedAt': confirmation.acceptedAt,
      }),
    }));
  } catch (err) {
    Logger.error('Failed to write acceptance to DynamoDB', {
      hospitalId,
      emergencyId,
      error: (err as Error).message,
    });
    return jsonResponse(500, { error: 'Failed to record acceptance' });
  }

  Logger.info('Hospital accepted emergency patient', { hospitalId, emergencyId, estimatedArrival });

  return jsonResponse(200, confirmation);
}

// ─── GET /hospital/status ─────────────────────────────────────────────────────

/**
 * Hospital dashboard polls this endpoint to see pending emergencies.
 * Returns all emergencies with status="pending" that include this hospital's ID.
 *
 * Query params:
 *   hospitalId: string — the hospital polling for its notifications
 *
 * Response:
 *   { emergencies: PendingEmergency[] }
 *
 * Real-world scenario: The Hamidia Hospital dashboard refreshes every 10s.
 * When a cardiac alert arrives, the next poll returns it and the UI shows
 * the alert with ABCDE summary, condition, and an "Accept" button.
 *
 * Req 5.1: Hospital dashboard receives and displays emergency notifications.
 */
async function handleStatus(
  event: APIGatewayProxyEvent,
  deps: HospitalDashboardDeps,
): Promise<APIGatewayProxyResult> {
  const hospitalId = event.queryStringParameters?.['hospitalId'];

  if (!hospitalId) {
    return jsonResponse(400, { error: 'Missing hospitalId query parameter' });
  }

  try {
    // Scan for pending emergencies that include this hospital
    // Production: use a GSI on notifiedHospitalIds for efficient lookup
    // Prototype: scan is acceptable — emergency table is small (TTL = 2h)
    const result = await deps.dynamo.send(new QueryCommand({
      TableName: EMERGENCIES_TABLE,
      IndexName: 'status-index',
      KeyConditionExpression: '#s = :pending',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: marshall({ ':pending': 'pending' }),
    }));

    const emergencies = (result.Items ?? [])
      .map(item => unmarshall(item))
      .filter(e => Array.isArray(e.notifiedHospitalIds) && e.notifiedHospitalIds.includes(hospitalId))
      .map(e => ({
        emergencyId: e.emergencyId,
        condition: e.condition,
        icd10Code: e.icd10Code,
        abcdeSummary: e.abcdeSummary,
        dispatchType: e.dispatchType,
        location: e.location,
        createdAt: e.createdAt,
        status: e.status,
      }));

    return jsonResponse(200, { emergencies });
  } catch (err) {
    Logger.error('Failed to query pending emergencies', {
      hospitalId,
      error: (err as Error).message,
    });
    return jsonResponse(500, { error: 'Failed to retrieve emergencies' });
  }
}

// ─── Factory + Lambda exports ─────────────────────────────────────────────────

export function createHospitalHandler(deps: Partial<HospitalDashboardDeps> = {}) {
  const resolved = { ...createDefaultDeps(), ...deps };

  return {
    notify: withErrorHandler('hospitalNotify', (event: APIGatewayProxyEvent) => handleNotify(event, resolved)),
    accept: withErrorHandler('hospitalAccept', (event: APIGatewayProxyEvent) => handleAccept(event, resolved)),
    status: withErrorHandler('hospitalStatus', (event: APIGatewayProxyEvent) => handleStatus(event, resolved)),
  };
}

const _default = createHospitalHandler();

/**
 * Main Lambda handler — routes by path:
 *   POST /hospital/notify  → handleNotify
 *   POST /hospital/accept  → handleAccept
 *   GET  /hospital/status  → handleStatus
 */
export const handler = withErrorHandler(
  'hospitalDashboard',
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const path = event.path ?? event.requestContext?.resourcePath ?? '';
    const method = event.httpMethod?.toUpperCase() ?? 'POST';

    if (path.endsWith('/hospital/notify') && method === 'POST') {
      return _default.notify(event) as Promise<APIGatewayProxyResult>;
    }
    if (path.endsWith('/hospital/accept') && method === 'POST') {
      return _default.accept(event) as Promise<APIGatewayProxyResult>;
    }
    if (path.endsWith('/hospital/status') && method === 'GET') {
      return _default.status(event) as Promise<APIGatewayProxyResult>;
    }

    Logger.warn('Unknown hospital dashboard path', { path, method });
    return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Not found' }) };
  },
);
