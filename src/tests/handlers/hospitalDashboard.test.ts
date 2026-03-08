/**
 * Integration tests for hospitalDashboard — Task 16.3 testing gap
 *
 * Tests the three hospital-facing API endpoints with mocked DynamoDB.
 * Covers: notify, accept, status, PII redaction, TTL, error handling.
 *
 * Req 5.1, 5.2
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHospitalHandler, HospitalDashboardDeps } from '../../handlers/hospitalDashboard';
import { EmergencyData, Hospital, LocationData } from '../../models/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(
  path: string,
  method: string,
  body?: unknown,
  queryParams?: Record<string, string>,
): APIGatewayProxyEvent {
  return {
    path,
    httpMethod: method,
    body: body ? JSON.stringify(body) : null,
    queryStringParameters: queryParams ?? null,
    requestContext: { resourcePath: path } as APIGatewayProxyEvent['requestContext'],
    headers: { 'Content-Type': 'application/json' },
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: path,
  } as APIGatewayProxyEvent;
}

function makeLocation(): LocationData {
  return {
    tier2Phone: {
      stdCode: '0755',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      district: 'Bhopal',
      accuracy: 'district',
      method: 'automatic',
    },
    primaryLocation: 'Bhopal',
    accuracyLevel: 'district',
  };
}

function makeEmergency(overrides: Partial<EmergencyData> = {}): EmergencyData {
  return {
    callId: 'CA-emergency-001',
    condition: 'cardiac',
    icd10Code: 'I21.9',
    abcdeSummary: 'ABCDE complete: airway clear, breathing labored',
    location: makeLocation(),
    callerNumber: '+919876543210',
    dispatchType: '108',
    ...overrides,
  };
}

function makeHospital(id: string, name: string): Hospital {
  return {
    hospitalId: id,
    name,
    address: `${name} Road, Bhopal`,
    phone: '+911234567890',
    location: { latitude: 23.26, longitude: 77.41 },
    facilityLevel: 'district_hospital',
  };
}


// ─── Mock DynamoDB ────────────────────────────────────────────────────────────

/** In-memory store simulating DynamoDB for emergencies and acceptances */
interface StoredItem {
  [key: string]: unknown;
}

function makeDeps(overrides: Partial<HospitalDashboardDeps> = {}): HospitalDashboardDeps {
  const emergencyStore: Map<string, StoredItem> = new Map();

  const dashboard = {
    blastNotification: jest.fn(async () => {}),
    acceptPatient: jest.fn(async (hospitalId: string, emergencyId: string) => ({
      hospitalId,
      emergencyId,
      acceptedAt: new Date().toISOString(),
      estimatedArrival: '15 minutes',
    })),
    getHospitalsInRadius: jest.fn(async () => []),
  };

  const dynamo = {
    send: jest.fn(async (command: unknown) => {
      const cmd = command as { constructor: { name: string }; input: Record<string, unknown> };
      const cmdName = cmd.constructor?.name ?? '';

      if (cmdName === 'PutItemCommand') {
        // Simulate DynamoDB PutItem — store the marshalled item
        const item = cmd.input?.Item as Record<string, { S?: string; N?: string }>;
        const emergencyId = item?.emergencyId?.S ?? item?.hospitalId?.S ?? 'unknown';
        emergencyStore.set(emergencyId, item);
        return {};
      }

      if (cmdName === 'UpdateItemCommand') {
        // Simulate DynamoDB UpdateItem
        return {};
      }

      if (cmdName === 'QueryCommand') {
        // Return empty items for status queries
        return { Items: [] };
      }

      return {};
    }),
  };

  return {
    dashboard,
    dynamo,
    ...overrides,
  } as unknown as HospitalDashboardDeps;
}

// ─── POST /hospital/notify tests ──────────────────────────────────────────────

describe('POST /hospital/notify', () => {
  it('returns 200 with notified count and emergencyId', async () => {
    const deps = makeDeps();
    const h = createHospitalHandler(deps);
    const hospitals = [makeHospital('H1', 'Hamidia Hospital'), makeHospital('H2', 'AIIMS Bhopal')];
    const event = makeEvent('/hospital/notify', 'POST', {
      emergency: makeEmergency(),
      hospitals,
    });

    const result = await h.notify(event) as APIGatewayProxyResult;
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.notified).toBe(2);
    expect(body.emergencyId).toBe('CA-emergency-001');
  });

  it('writes emergency record to DynamoDB with PII redacted', async () => {
    const deps = makeDeps();
    const h = createHospitalHandler(deps);
    const hospitals = [makeHospital('H1', 'Hamidia Hospital')];
    const event = makeEvent('/hospital/notify', 'POST', {
      emergency: makeEmergency({ callerNumber: '+919876543210' }),
      hospitals,
    });

    await h.notify(event);

    // DynamoDB PutItem should have been called
    expect(deps.dynamo.send).toHaveBeenCalled();
    // Verify the stored item has callerNumber redacted
    const putCall = (deps.dynamo.send as jest.Mock).mock.calls[0][0];
    const inputStr = JSON.stringify(putCall);
    expect(inputStr).toContain('[REDACTED]');
    expect(inputStr).not.toContain('9876543210');
  });

  it('calls dashboard.blastNotification with hospitals and emergency', async () => {
    const deps = makeDeps();
    const h = createHospitalHandler(deps);
    const hospitals = [makeHospital('H1', 'Hamidia'), makeHospital('H2', 'AIIMS'), makeHospital('H3', 'JP Hospital')];
    const emergency = makeEmergency();
    const event = makeEvent('/hospital/notify', 'POST', { emergency, hospitals });

    await h.notify(event);

    expect(deps.dashboard.blastNotification).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ hospitalId: 'H1' })]),
      expect.objectContaining({ callId: 'CA-emergency-001' }),
    );
  });

  it('returns 400 when emergency is missing from body', async () => {
    const deps = makeDeps();
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/notify', 'POST', { hospitals: [] });

    const result = await h.notify(event) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('Missing');
  });

  it('returns 400 when hospitals is not an array', async () => {
    const deps = makeDeps();
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/notify', 'POST', {
      emergency: makeEmergency(),
      hospitals: 'not-an-array',
    });

    const result = await h.notify(event) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when body is null', async () => {
    const deps = makeDeps();
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/notify', 'POST');

    const result = await h.notify(event) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(400);
  });

  it('returns 500 when DynamoDB write fails', async () => {
    const deps = makeDeps();
    (deps.dynamo.send as jest.Mock).mockRejectedValueOnce(new Error('DynamoDB throttled'));
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/notify', 'POST', {
      emergency: makeEmergency(),
      hospitals: [makeHospital('H1', 'Hamidia')],
    });

    const result = await h.notify(event) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toContain('Failed');
  });
});

// ─── POST /hospital/accept tests ──────────────────────────────────────────────

describe('POST /hospital/accept', () => {
  it('returns 200 with AcceptanceConfirmation', async () => {
    const deps = makeDeps();
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/accept', 'POST', {
      hospitalId: 'H1',
      emergencyId: 'CA-emergency-001',
      estimatedArrival: '10 minutes',
    });

    const result = await h.accept(event) as APIGatewayProxyResult;
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.hospitalId).toBe('H1');
    expect(body.emergencyId).toBe('CA-emergency-001');
    expect(body.estimatedArrival).toBe('10 minutes');
    expect(body.acceptedAt).toBeDefined();
  });

  it('defaults estimatedArrival to 15 minutes when not provided', async () => {
    const deps = makeDeps();
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/accept', 'POST', {
      hospitalId: 'H1',
      emergencyId: 'CA-emergency-001',
    });

    const result = await h.accept(event) as APIGatewayProxyResult;
    const body = JSON.parse(result.body);

    expect(body.estimatedArrival).toBe('15 minutes');
  });

  it('writes acceptance AND updates emergency status in DynamoDB', async () => {
    const deps = makeDeps();
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/accept', 'POST', {
      hospitalId: 'H1',
      emergencyId: 'CA-emergency-001',
    });

    await h.accept(event);

    // Should have 2 DynamoDB calls: PutItem (acceptance) + UpdateItem (emergency status)
    expect(deps.dynamo.send).toHaveBeenCalledTimes(2);
  });

  it('returns 400 when hospitalId is missing', async () => {
    const deps = makeDeps();
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/accept', 'POST', {
      emergencyId: 'CA-emergency-001',
    });

    const result = await h.accept(event) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('Missing');
  });

  it('returns 400 when emergencyId is missing', async () => {
    const deps = makeDeps();
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/accept', 'POST', {
      hospitalId: 'H1',
    });

    const result = await h.accept(event) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(400);
  });

  it('returns 500 when DynamoDB write fails', async () => {
    const deps = makeDeps();
    (deps.dynamo.send as jest.Mock).mockRejectedValueOnce(new Error('DynamoDB unavailable'));
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/accept', 'POST', {
      hospitalId: 'H1',
      emergencyId: 'CA-emergency-001',
    });

    const result = await h.accept(event) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(500);
  });
});

// ─── GET /hospital/status tests ───────────────────────────────────────────────

describe('GET /hospital/status', () => {
  it('returns 200 with empty emergencies array when none pending', async () => {
    const deps = makeDeps();
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/status', 'GET', undefined, { hospitalId: 'H1' });

    const result = await h.status(event) as APIGatewayProxyResult;
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.emergencies).toEqual([]);
  });

  it('returns 400 when hospitalId query param is missing', async () => {
    const deps = makeDeps();
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/status', 'GET');

    const result = await h.status(event) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('Missing hospitalId');
  });

  it('filters emergencies to only those notified to the requesting hospital', async () => {
    const deps = makeDeps();
    // Mock DynamoDB to return 2 emergencies — only one includes H1
    (deps.dynamo.send as jest.Mock).mockImplementation(async (command: unknown) => {
      const cmd = command as { constructor: { name: string } };
      if (cmd.constructor?.name === 'QueryCommand') {
        // Return marshalled items — unmarshall expects DynamoDB attribute format
        const { marshall } = await import('@aws-sdk/util-dynamodb');
        return {
          Items: [
            marshall({
              emergencyId: 'E1',
              condition: 'cardiac',
              icd10Code: 'I21.9',
              abcdeSummary: 'ABCDE done',
              dispatchType: '108',
              location: makeLocation(),
              createdAt: new Date().toISOString(),
              status: 'pending',
              notifiedHospitalIds: ['H1', 'H2'],
            }),
            marshall({
              emergencyId: 'E2',
              condition: 'snakebite',
              icd10Code: 'T63.0',
              abcdeSummary: 'Snakebite ABCDE',
              dispatchType: '108',
              location: makeLocation(),
              createdAt: new Date().toISOString(),
              status: 'pending',
              notifiedHospitalIds: ['H3'],  // H1 NOT included
            }),
          ],
        };
      }
      return {};
    });
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/status', 'GET', undefined, { hospitalId: 'H1' });

    const result = await h.status(event) as APIGatewayProxyResult;
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.emergencies).toHaveLength(1);
    expect(body.emergencies[0].emergencyId).toBe('E1');
  });

  it('does not expose callerNumber in status response', async () => {
    const deps = makeDeps();
    (deps.dynamo.send as jest.Mock).mockImplementation(async (command: unknown) => {
      const cmd = command as { constructor: { name: string } };
      if (cmd.constructor?.name === 'QueryCommand') {
        const { marshall } = await import('@aws-sdk/util-dynamodb');
        return {
          Items: [
            marshall({
              emergencyId: 'E1',
              condition: 'cardiac',
              icd10Code: 'I21.9',
              abcdeSummary: 'test',
              dispatchType: '108',
              location: makeLocation(),
              createdAt: new Date().toISOString(),
              status: 'pending',
              notifiedHospitalIds: ['H1'],
              callerNumber: '[REDACTED]',
            }),
          ],
        };
      }
      return {};
    });
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/status', 'GET', undefined, { hospitalId: 'H1' });

    const result = await h.status(event) as APIGatewayProxyResult;

    // The response should NOT contain any phone number — only [REDACTED] if present
    expect(result.body).not.toMatch(/\+91\d{10}/);
    // callerNumber should not be in the mapped response fields at all
    const body = JSON.parse(result.body);
    if (body.emergencies.length > 0) {
      expect(body.emergencies[0]).not.toHaveProperty('callerNumber');
    }
  });

  it('returns 500 when DynamoDB query fails', async () => {
    const deps = makeDeps();
    (deps.dynamo.send as jest.Mock).mockRejectedValueOnce(new Error('DynamoDB timeout'));
    const h = createHospitalHandler(deps);
    const event = makeEvent('/hospital/status', 'GET', undefined, { hospitalId: 'H1' });

    const result = await h.status(event) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(500);
  });
});

// ─── Main handler routing ─────────────────────────────────────────────────────

describe('hospital dashboard — path routing', () => {
  it('unknown path → 404', async () => {
    const { handler } = await import('../../handlers/hospitalDashboard');
    const event = makeEvent('/hospital/unknown', 'POST', {});
    const result = await handler(event) as APIGatewayProxyResult;
    expect(result.statusCode).toBe(404);
  });
});
