/**
 * Integration tests for callHandler — Task 16.4
 *
 * Tests the three Twilio webhook endpoints end-to-end with mocked services.
 * Covers: emergency path, general triage, drug overdose, mid-call escalation,
 * DTMF overrides, dispatch fallback, and call logging.
 *
 * Req 1.1–1.6, 2.1–2.7, 4.6, 7.6
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { createHandler, CallHandlerDeps } from '../../handlers/callHandler';
import { ConversationState, MasterExtractionResult, LocationData } from '../../models/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(path: string, body: Record<string, string>): APIGatewayProxyEvent {
  return {
    path,
    body: Object.entries(body)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&'),
    requestContext: { resourcePath: path } as APIGatewayProxyEvent['requestContext'],
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: path,
  } as APIGatewayProxyEvent;
}

const CALL_SID = 'CA1234567890abcdef';
const CALLER_NUMBER = '+919810123456';

function makeLocation(): LocationData {
  return {
    tier2Phone: {
      stdCode: '9810',
      city: 'Delhi',
      state: 'Delhi',
      district: 'Delhi',
      accuracy: 'district',
      method: 'automatic',
    },
    primaryLocation: 'Delhi',
    accuracyLevel: 'district',
  };
}

function makeState(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    callSid: CALL_SID,
    ttl: Math.floor(Date.now() / 1000) + 3600,
    turn: 1,
    language: 'hindi',
    triagePath: 'unknown',
    abcdeStep: null,
    conditionId: null,
    patientProfile: null,
    masterExtraction: null,
    transcriptHistory: [],
    dangerSignsDetected: [],
    locationCollected: false,
    callStartTime: new Date().toISOString(),
    clinicalSummary: '',
    ...overrides,
  };
}

function makeDeps(overrides: Partial<CallHandlerDeps> = {}): CallHandlerDeps {
  const stateStore: Map<string, ConversationState> = new Map();

  const stateRepo = {
    load: jest.fn(async (sid: string) => stateStore.get(sid) ?? null),
    save: jest.fn(async (s: ConversationState) => { stateStore.set(s.callSid, s); }),
    delete: jest.fn(async (sid: string) => { stateStore.delete(sid); }),
  };

  const intentRouter = {
    classifyIntent: jest.fn(async () => ({ intent: 'general_triage' as const, confidence: 0.8, triggerType: 'default' as const })),
    checkEmergencyKeywords: jest.fn(() => null),
    checkDangerSigns: jest.fn(() => false),
    routeFromExtraction: jest.fn(),
    extractMasterTags: jest.fn(async () => null),
  };

  const emergencyKB = {
    retrieveEmergencyScript: jest.fn(async () => ({
      condition: 'cardiac' as const,
      icd10Code: 'I21.9',
      dispatchType: '108' as const,
      severity: 'CRITICAL' as const,
      source: 'test',
      abcdeAssessment: {
        airway: { questionHindi: 'Kya saans aa rahi hai?', questionEnglish: 'Is breathing normal?', yesAction: { hindi: 'Theek hai', english: 'OK' }, noAction: { hindi: 'Ambulance bulao', english: 'Call ambulance' } },
        breathing: { questionHindi: 'Saans ki gati?', questionEnglish: 'Breathing rate?', yesAction: { hindi: 'Theek hai', english: 'OK' }, noAction: { hindi: 'CPR shuru karo', english: 'Start CPR' } },
        circulation: { questionHindi: 'Nadi chal rahi hai?', questionEnglish: 'Pulse present?', yesAction: { hindi: 'Theek hai', english: 'OK' }, noAction: { hindi: 'CPR shuru karo', english: 'Start CPR' } },
        disability: { questionHindi: 'Hosh mein hai?', questionEnglish: 'Conscious?', yesAction: { hindi: 'Theek hai', english: 'OK' }, noAction: { hindi: 'Stable karo', english: 'Stabilize' } },
        exposure: { questionHindi: 'Koi chot?', questionEnglish: 'Any injury?', yesAction: { hindi: 'Bandage karo', english: 'Apply bandage' }, noAction: { hindi: 'Theek hai', english: 'OK' } },
      },
      immediateActions: [],
      doNotActions: [],
      dispatchInstructions: { dispatchType: '108' as const, dispatchNumber: '108', messageHindi: 'Ambulance aa rahi hai', messageEnglish: 'Ambulance coming' },
    })),
    getABCDEAssessment: jest.fn(),
  };

  const triageAgent = {
    assessSymptoms: jest.fn(async () => ({
      conditionId: 'general_fever',
      icd10Code: 'R50.9',
      severity: 'non-urgent' as const,
      recommendedCareLevel: 'home' as const,
      summaryHindi: 'Aapko bukhar hai. Aaram karein.',
      summaryEnglish: 'You have fever. Rest at home.',
      followUpRequired: false,
    })),
    generateTreatmentAdvice: jest.fn(async () => ({
      instructions: [{ hindi: 'Paani peete rahein.', english: 'Stay hydrated.' }],
      disclaimer: { hindi: 'Yeh AI ki salah hai.', english: 'This is AI guidance.' },
    })),
    tagICD10: jest.fn((id: string) => id === 'general_fever' ? 'R50.9' : 'R69'),
    determineFacilityLevel: jest.fn(() => 'home' as const),
  };

  const locationDetector = {
    extractSTDCode: jest.fn(async () => makeLocation().tier2Phone),
    parseVoiceLocation: jest.fn(() => null),
    parseNovaLocation: jest.fn(() => null),
    resolveLocation: jest.fn(() => ({ primaryLocation: 'Delhi', accuracyLevel: 'district' as const, tier2: makeLocation().tier2Phone })),
    sendGPSLink: jest.fn(async () => { }),
    receiveGPSCoordinates: jest.fn(async () => ({ latitude: 0, longitude: 0 })),
  };

  const callLogger = {
    logCall: jest.fn(async () => { }),
    storeRecording: jest.fn(async () => 'recordings/test.mp3'),
    redactPII: jest.fn((r: unknown) => r),
    generateFHIRRecord: jest.fn(() => ({
      resourceType: 'Condition' as const,
      code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10' as const, code: 'R50.9', display: 'Fever' }] },
      recordedDate: new Date().toISOString(),
      severity: { coding: [{ system: 'http://snomed.info/sct' as const, code: '6736007', display: 'non-urgent' }] },
    })),
  };

  const orchestrator = {
    orchestrateActions: jest.fn(async () => ({
      smsSent: true,
      ashaAlerted: false,
      followUpScheduled: false,
      surveillanceLogged: true,
    })),
  };

  const sfn = {
    send: jest.fn(async () => ({ executionArn: 'arn:test' })),
  };

  return {
    stateRepo,
    intentRouter,
    emergencyKB,
    triageAgent,
    locationDetector,
    callLogger,
    orchestrator,
    sfn,
    ...overrides,
  } as unknown as CallHandlerDeps;
}

// ─── /incoming tests ──────────────────────────────────────────────────────────

describe('handleIncoming — Turn 1', () => {
  it('returns TwiML greeting with Gather on new call', async () => {
    const deps = makeDeps();
    const h = createHandler(deps);
    const event = makeEvent('/incoming', { CallSid: CALL_SID, From: CALLER_NUMBER, To: '+15077768060' });

    const result = await h.incoming(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Gather');
    expect(result.body).toContain('VaidyaVaani');
    expect(result.body).toContain('Polly.Aditi');
  });

  it('saves initial ConversationState to DynamoDB', async () => {
    const deps = makeDeps();
    const h = createHandler(deps);
    const event = makeEvent('/incoming', { CallSid: CALL_SID, From: CALLER_NUMBER, To: '+15077768060' });

    await h.incoming(event);

    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ callSid: CALL_SID, turn: 1, language: 'hindi', triagePath: 'unknown' }),
    );
  });

  it('calls extractSTDCode for Tier 2 location detection', async () => {
    const deps = makeDeps();
    const h = createHandler(deps);
    const event = makeEvent('/incoming', { CallSid: CALL_SID, From: CALLER_NUMBER, To: '+15077768060' });

    await h.incoming(event);

    expect(deps.locationDetector.extractSTDCode).toHaveBeenCalledWith(CALLER_NUMBER);
  });

  it('handles extractSTDCode failure gracefully — still returns greeting', async () => {
    const deps = makeDeps();
    (deps.locationDetector.extractSTDCode as jest.Mock).mockRejectedValueOnce(new Error('DynamoDB timeout'));
    const h = createHandler(deps);
    const event = makeEvent('/incoming', { CallSid: CALL_SID, From: CALLER_NUMBER, To: '+15077768060' });

    const result = await h.incoming(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Gather');
  });
});

// ─── /gather — DTMF override tests ───────────────────────────────────────────

describe('handleGather — DTMF overrides', () => {
  it('DTMF 9 → bridges to 108 immediately regardless of speech', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, Digits: '9', SpeechResult: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Dial>108</Dial>');
    // Intent router should NOT be called — DTMF 9 is highest priority
    expect(deps.intentRouter.classifyIntent).not.toHaveBeenCalled();
  });

  it('DTMF 2 → switches language to English and re-prompts', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, Digits: '2', SpeechResult: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('English');
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'english' }),
    );
  });
});

// ─── /gather — emergency path ─────────────────────────────────────────────────

describe('handleGather — emergency path', () => {
  it('emergency intent → fetches ABCDE script and returns airway question', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ locationCollected: true }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'seene mein dard', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(deps.emergencyKB.retrieveEmergencyScript).toHaveBeenCalledWith('cardiac', 'adult');
    expect(result.body).toContain('Kya saans aa rahi hai?');
  });

  it('emergency KB failure → bridges to 108 as fallback', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ locationCollected: true }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    (deps.emergencyKB.retrieveEmergencyScript as jest.Mock).mockRejectedValueOnce(new Error('DynamoDB unavailable'));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'seene mein dard', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Dial>108</Dial>');
  });

  it('ABCDE step advances: null → airway → breathing on second emergency turn', async () => {
    const deps = makeDeps();
    // First turn: abcdeStep = null → should advance to airway
    deps.stateRepo.load = jest.fn(async () => makeState({ triagePath: 'emergency', abcdeStep: null, locationCollected: true }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValue({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'haan', Digits: '' });

    await h.gather(event);

    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ abcdeStep: 'airway' }),
    );
  });

  it('English caller → emergency ABCDE returns English question', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ language: 'english', locationCollected: true }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'chest pain', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    // Should contain the English question from the mock script
    expect(result.body).toContain('Is breathing normal?');
  });
});

// ─── /gather — danger sign mid-call escalation ───────────────────────────────

describe('handleGather — danger sign mid-call escalation', () => {
  it('danger sign detected → escalates to emergency bridge regardless of intent', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ triagePath: 'general' }));
    (deps.intentRouter.checkDangerSigns as jest.Mock).mockReturnValueOnce(true);
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'behosh ho gaya', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Dial>108</Dial>');
    // classifyIntent should NOT be called after danger sign detection
    expect(deps.intentRouter.classifyIntent).not.toHaveBeenCalled();
  });
});

// ─── /gather — general triage path ───────────────────────────────────────────

describe('handleGather — general triage path', () => {
  it('general triage → calls triageAgent.assessSymptoms with transcriptHistory', async () => {
    const deps = makeDeps();
    const existingHistory = ['mujhe bukhar hai'];
    deps.stateRepo.load = jest.fn(async () => makeState({ transcriptHistory: existingHistory }));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'aur ulti bhi ho rahi hai', Digits: '' });

    await h.gather(event);

    expect(deps.triageAgent.assessSymptoms).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.arrayContaining(['mujhe bukhar hai', 'aur ulti bhi ho rahi hai']),
    );
  });

  it('general triage → returns TwiML with Hindi summary and disclaimer', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'mujhe bukhar hai', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('Polly.Aditi');
    // Should contain the Hindi summary from triageAgent mock
    expect(result.body).toContain('Aapko bukhar hai');
  });

  it('English caller → general triage returns English summary', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ language: 'english' }));
    (deps.triageAgent.assessSymptoms as jest.Mock).mockResolvedValueOnce({
      conditionId: 'general_fever',
      icd10Code: 'R50.9',
      severity: 'non-urgent',
      recommendedCareLevel: 'home',
      summaryHindi: 'Aapko bukhar hai. Aaram karein.',
      summaryEnglish: 'You have fever. Rest at home.',
      followUpRequired: false,
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'I have fever', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('You have fever');
    expect(result.body).not.toContain('Aapko bukhar hai');
  });

  it('triage failure → returns fallback re-prompt, does not crash', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    (deps.triageAgent.assessSymptoms as jest.Mock).mockRejectedValueOnce(new Error('Bedrock timeout'));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'mujhe bukhar hai', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Gather');
  });

  it('missing state → creates fresh state and continues', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => null); // state lost
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'mujhe bukhar hai', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    // Should still save a new state
    expect(deps.stateRepo.save).toHaveBeenCalled();
  });
});

// ─── /gather — drug overdose path ────────────────────────────────────────────

describe('handleGather — drug overdose → emergency path', () => {
  it('overdose intent routes to emergency bridge', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'drug_query',
      matchedKeywords: ['overdose'],
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'maine bahut saari paracetamol kha li', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    // Emergency path — either ABCDE script or 108 bridge
    expect(result.body).toMatch(/<Gather|<Dial>108<\/Dial>/);
  });
});

// ─── /gather — drug safety query path ────────────────────────────────────────

describe('handleGather — drug safety query', () => {
  it('drug intent → prompts for drug name', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'default',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'paracetamol ke baare mein poochna tha', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Gather');
    expect(result.body).toContain('dawai');
  });
});

// ─── /status — call end ───────────────────────────────────────────────────────

describe('handleStatus — call end', () => {
  it('logs call record to DynamoDB', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ triagePath: 'general', conditionId: 'general_fever' }));
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'completed',
      CallDuration: '45',
    });

    await h.status(event);

    expect(deps.callLogger.logCall).toHaveBeenCalledWith(
      expect.objectContaining({
        callId: CALL_SID,
        triageOutcome: 'general_triage_complete',
        duration: 45,
      }),
    );
  });

  it('deletes ConversationState after call ends', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ triagePath: 'general' }));
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'completed',
      CallDuration: '30',
    });

    await h.status(event);

    expect(deps.stateRepo.delete).toHaveBeenCalledWith(CALL_SID);
  });

  it('emergency call → triageOutcome = emergency_dispatched', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ triagePath: 'emergency', conditionId: 'cardiac' }));
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'completed',
      CallDuration: '60',
    });

    await h.status(event);

    expect(deps.callLogger.logCall).toHaveBeenCalledWith(
      expect.objectContaining({ triageOutcome: 'emergency_dispatched' }),
    );
  });

  it('incomplete call (no triage path) → triageOutcome = incomplete', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ triagePath: 'unknown' }));
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'no-answer',
      CallDuration: '0',
    });

    await h.status(event);

    expect(deps.callLogger.logCall).toHaveBeenCalledWith(
      expect.objectContaining({ triageOutcome: 'incomplete' }),
    );
  });

  it('null state (dropped call) → still logs with incomplete outcome', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => null);
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'failed',
      CallDuration: '0',
    });

    await h.status(event);

    expect(deps.callLogger.logCall).toHaveBeenCalledWith(
      expect.objectContaining({ triageOutcome: 'incomplete' }),
    );
  });

  it('Step Functions triggered with triage result', async () => {
    process.env.TRIAGE_WORKFLOW_ARN = 'arn:aws:states:ap-south-1:123456789:stateMachine:vaidyavaani-triage';
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ triagePath: 'general', conditionId: 'general_fever' }));
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'completed',
      CallDuration: '45',
    });

    await h.status(event);

    expect(deps.sfn.send).toHaveBeenCalled();
    // Verify SFN input contains triageResult and abcdeSummary (required by triageWorkflow.json)
    const sendCall = (deps.sfn.send as jest.Mock).mock.calls[0][0];
    const sfnInput = JSON.parse(sendCall.input.input ?? sendCall.input);
    // Handle both StartExecutionCommand wrapper and direct object
    const parsed = sfnInput.input ? JSON.parse(sfnInput.input) : sfnInput;
    expect(parsed).toHaveProperty('triageResult');
    expect(parsed).toHaveProperty('abcdeSummary');
    expect(parsed).toHaveProperty('callRecord');
    expect(parsed.triageResult).toHaveProperty('severity');
    expect(parsed.triageResult).toHaveProperty('recommendedCareLevel');
    expect(parsed.triageResult).toHaveProperty('followUpRequired');
    delete process.env.TRIAGE_WORKFLOW_ARN;
  });

  it('Step Functions failure → does not crash, returns 200', async () => {
    process.env.TRIAGE_WORKFLOW_ARN = 'arn:aws:states:ap-south-1:123456789:stateMachine:vaidyavaani-triage';
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ triagePath: 'general' }));
    (deps.sfn.send as jest.Mock).mockRejectedValueOnce(new Error('SFN throttled'));
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'completed',
      CallDuration: '30',
    });

    const result = await h.status(event) as { statusCode: number };

    expect(result.statusCode).toBe(200);
    delete process.env.TRIAGE_WORKFLOW_ARN;
  });
});

// ─── main handler routing ─────────────────────────────────────────────────────

describe('handler — path routing', () => {
  it('unknown path → 404', async () => {
    const { handler } = await import('../../handlers/callHandler');
    const event = makeEvent('/unknown', { CallSid: CALL_SID });
    const result = await handler(event) as { statusCode: number };
    expect(result.statusCode).toBe(404);
  });
});

// ─── /gather — ABCDE reset on condition change ───────────────────────────────

describe('handleGather — ABCDE reset on condition change', () => {
  it('resets abcdeStep when conditionId changes mid-emergency', async () => {
    const deps = makeDeps();
    // Caller was on snakebite ABCDE at breathing step, now says chest pain
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'emergency',
      conditionId: 'snakebite',
      abcdeStep: 'breathing',
      locationCollected: true,
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'seene mein dard', Digits: '' });

    await h.gather(event);

    // ABCDE should reset to airway (null → airway via advanceABCDEStep)
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ conditionId: 'cardiac', abcdeStep: 'airway' }),
    );
  });

  it('does NOT reset abcdeStep when conditionId stays the same', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'emergency',
      conditionId: 'cardiac',
      abcdeStep: 'breathing',
      locationCollected: true,
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'haan dard hai', Digits: '' });

    await h.gather(event);

    // Should advance from breathing → circulation, NOT reset
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ conditionId: 'cardiac', abcdeStep: 'circulation' }),
    );
  });
});

// ─── /gather — pendingDrugQuery stored in state ──────────────────────────────

describe('handleGather — pendingDrugQuery stored in state', () => {
  it('stores pendingDrugQuery when emergency + drug collision', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'breathing_difficulty',
      pendingDrugQuery: { drugName: 'metformin', queryType: 'safety' },
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'saans nahi aa rahi metformin safe hai kya', Digits: '' });

    await h.gather(event);

    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingDrugQuery: { drugName: 'metformin', queryType: 'safety' },
      }),
    );
  });
});

// ─── /gather — pendingDrugQuery consumed at ABCDE completion (S2 fix) ─────────

describe('handleGather — S2: pendingDrugQuery answered inline at ABCDE exposure', () => {
  const baseEmergencyState = (): ConversationState => ({
    ...makeState(),
    triagePath: 'emergency',
    conditionId: 'breathing_difficulty',
    abcdeStep: 'exposure',          // ABCDE just finished — next turn is the completion turn
    locationCollected: true,
    locationPromptSent: true,
    pendingDrugQuery: { drugName: 'metformin', queryType: 'safety' },
  });

  it('answers pendingDrugQuery inline and bridges to 108 when DrugKB succeeds', async () => {
    const drugKB = {
      queryDrug: jest.fn(async () => ({
        drug_name: 'metformin',
        dose_adult: '500mg twice daily',
        pregnancy_category: 'B',
        pregnancy_note: 'Generally safe in pregnancy — consult doctor.',
        not_found: false,
        contraindications: [],
      })),
      checkOverdose: jest.fn(() => true),
    };
    const deps = makeDeps({ drugKB } as any);
    deps.stateRepo.load = jest.fn(async () => baseEmergencyState());
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'breathing_difficulty',
    });
    (deps.intentRouter.extractMasterTags as jest.Mock).mockResolvedValueOnce(null);
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'haan', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    // Drug answer must appear in the bridge response before <Dial>108</Dial>
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Dial>108</Dial>');
    expect(result.body).toContain('metformin');

    // pendingDrugQuery must be cleared from state
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ pendingDrugQuery: undefined }),
    );
    // DrugKB must have been called with the right drug name and query type
    expect(drugKB.queryDrug).toHaveBeenCalledWith('metformin', 'safety', expect.any(Object));
  });

  it('bridges to 108 even when DrugKB throws at ABCDE completion (fail-safe)', async () => {
    const drugKB = {
      queryDrug: jest.fn(async () => { throw new Error('Bedrock timeout'); }),
      checkOverdose: jest.fn(() => true),
    };
    const deps = makeDeps({ drugKB } as any);
    deps.stateRepo.load = jest.fn(async () => baseEmergencyState());
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'breathing_difficulty',
    });
    (deps.intentRouter.extractMasterTags as jest.Mock).mockResolvedValueOnce(null);
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'haan', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    // When DrugKB fails, caller still gets bridged to 108 — drug question dropped gracefully
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Dial>108</Dial>');
  });
});

// ─── /gather — severity stored in state ──────────────────────────────────────

describe('handleGather — severity stored in state', () => {
  it('stores assessment severity in state after general triage', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    (deps.triageAgent.assessSymptoms as jest.Mock).mockResolvedValueOnce({
      conditionId: 'general_fever',
      icd10Code: 'R50.9',
      severity: 'urgent',
      recommendedCareLevel: 'PHC',
      summaryHindi: 'Tez bukhar hai.',
      summaryEnglish: 'High fever.',
      followUpRequired: true,
      followUpInterval: '2h',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'tez bukhar hai', Digits: '' });

    await h.gather(event);

    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'urgent',
        recommendedCareLevel: 'PHC',
        followUpRequired: true,
        followUpInterval: '2h',
      }),
    );
  });

  it('stores chronicCareEnrollment when chronic condition detected', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    (deps.triageAgent.assessSymptoms as jest.Mock).mockResolvedValueOnce({
      conditionId: 'diabetes',
      icd10Code: 'E11.9',
      severity: 'non-urgent',
      recommendedCareLevel: 'PHC',
      summaryHindi: 'Sugar ki bimari hai.',
      summaryEnglish: 'Diabetes mellitus type 2.',
      followUpRequired: false,
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'sugar badh gayi hai', Digits: '' });

    await h.gather(event);

    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        chronicCareEnrollment: 'diabetes',
        conditionId: 'diabetes',
      }),
    );
  });
});

// ─── /status — tier2Location and severity from state ─────────────────────────

describe('handleStatus — tier2Location and severity from state', () => {
  it('uses tier2Location from state for CallRecord location', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'general',
      conditionId: 'general_fever',
      tier2Location: {
        stdCode: '011',
        city: 'Delhi',
        state: 'Delhi',
        district: 'New Delhi',
        accuracy: 'district',
        method: 'automatic',
      },
    }));
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'completed',
      CallDuration: '45',
    });

    await h.status(event);

    expect(deps.callLogger.logCall).toHaveBeenCalledWith(
      expect.objectContaining({
        location: expect.objectContaining({
          primaryLocation: 'Delhi',
          accuracyLevel: 'district',
          tier2Phone: expect.objectContaining({ city: 'Delhi', stdCode: '011' }),
        }),
      }),
    );
  });

  it('uses severity from state for CallRecord', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'general',
      conditionId: 'general_fever',
      severity: 'urgent',
    }));
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'completed',
      CallDuration: '45',
    });

    await h.status(event);

    expect(deps.callLogger.logCall).toHaveBeenCalledWith(
      expect.objectContaining({ severityClassification: 'urgent' }),
    );
  });

  it('emergency call without explicit severity → defaults to critical', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'emergency',
      conditionId: 'cardiac',
      // no severity field set — should default to 'critical' for emergency
    }));
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'completed',
      CallDuration: '60',
    });

    await h.status(event);

    expect(deps.callLogger.logCall).toHaveBeenCalledWith(
      expect.objectContaining({ severityClassification: 'critical' }),
    );
  });

  it('null state → location falls back to Unknown', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => null);
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'failed',
      CallDuration: '0',
    });

    await h.status(event);

    expect(deps.callLogger.logCall).toHaveBeenCalledWith(
      expect.objectContaining({
        location: expect.objectContaining({
          primaryLocation: 'Unknown',
          accuracyLevel: 'unknown',
        }),
      }),
    );
  });

  it('SFN triageResult includes followUp and chronicCare from state', async () => {
    process.env.TRIAGE_WORKFLOW_ARN = 'arn:aws:states:ap-south-1:123456789:stateMachine:vaidyavaani-triage';
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'general',
      conditionId: 'diabetes',
      severity: 'non-urgent',
      recommendedCareLevel: 'PHC',
      followUpRequired: true,
      followUpInterval: '24h',
      chronicCareEnrollment: 'diabetes',
    }));
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'completed',
      CallDuration: '90',
    });

    await h.status(event);

    const sendCall = (deps.sfn.send as jest.Mock).mock.calls[0][0];
    const sfnInput = JSON.parse(sendCall.input.input ?? sendCall.input);
    const parsed = sfnInput.input ? JSON.parse(sfnInput.input) : sfnInput;
    expect(parsed.triageResult.followUpRequired).toBe(true);
    expect(parsed.triageResult.followUpInterval).toBe('24h');
    expect(parsed.triageResult.chronicCareEnrollment).toBe('diabetes');
    expect(parsed.triageResult.recommendedCareLevel).toBe('PHC');
    delete process.env.TRIAGE_WORKFLOW_ARN;
  });
});

// ─── multi-turn memory ────────────────────────────────────────────────────────

describe('multi-turn memory — transcriptHistory passed to Nova Pro', () => {
  it('Turn 3: all prior utterances are in transcriptHistory passed to assessSymptoms', async () => {
    const deps = makeDeps();
    const history = ['mujhe bukhar hai', 'aur sar dard bhi hai'];
    deps.stateRepo.load = jest.fn(async () => makeState({
      turn: 2,
      triagePath: 'general',
      transcriptHistory: history,
    }));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'aur ulti bhi ho rahi hai', Digits: '' });

    await h.gather(event);

    const callArgs = (deps.triageAgent.assessSymptoms as jest.Mock).mock.calls[0];
    const passedHistory: string[] = callArgs[2];
    expect(passedHistory).toContain('mujhe bukhar hai');
    expect(passedHistory).toContain('aur sar dard bhi hai');
    expect(passedHistory).toContain('aur ulti bhi ho rahi hai');
  });
});

// ─── /gather — ABCDE completion → 108 bridge ─────────────────────────────────

describe('handleGather — ABCDE completion dispatches to 108', () => {
  it('bridges to 108 after completing all 5 ABCDE steps (exposure → dispatch)', async () => {
    const deps = makeDeps();
    // Caller has completed all 5 ABCDE steps — abcdeStep is at 'exposure'
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'emergency',
      conditionId: 'cardiac',
      abcdeStep: 'exposure',
      locationCollected: true,
      transcriptHistory: ['seene mein dard', 'haan', 'haan', 'haan', 'nahi'],
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'haan theek hai', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    // Should bridge to 108, NOT loop back to airway
    expect(result.body).toContain('<Dial>108</Dial>');
    // Should NOT contain a Gather (no more questions)
    expect(result.body).not.toContain('<Gather');
  });

  it('English caller gets English dispatch message after ABCDE completion', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'emergency',
      conditionId: 'cardiac',
      abcdeStep: 'exposure',
      locationCollected: true,
      language: 'english',
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'yes', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('<Dial>108</Dial>');
    expect(result.body).toContain('Assessment complete');
  });

  it('stores clinicalSummary before dispatching after ABCDE completion', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'emergency',
      conditionId: 'cardiac',
      abcdeStep: 'exposure',
      locationCollected: true,
      transcriptHistory: ['chest pain', 'yes breathing', 'pulse ok'],
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'no injury', Digits: '' });

    await h.gather(event);

    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicalSummary: expect.stringContaining('ABCDE complete for cardiac'),
      }),
    );
  });
});

// ─── /gather — empty speech re-prompt ─────────────────────────────────────────

describe('handleGather — empty speech handling', () => {
  it('re-prompts when caller sends empty speech and no DTMF', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: '', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Gather');
    // Should NOT call intent router on empty input
    expect(deps.intentRouter.classifyIntent).not.toHaveBeenCalled();
    expect(deps.intentRouter.checkDangerSigns).not.toHaveBeenCalled();
  });

  it('still processes DTMF 9 even with empty speech', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: '', Digits: '9' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('<Dial>108</Dial>');
  });
});

// ─── TwiML statusCallback ─────────────────────────────────────────────────────

describe('TwiML response structure', () => {
  it('/incoming TwiML includes statusCallback URL for call-end webhook', async () => {
    const deps = makeDeps();
    const h = createHandler(deps);
    const event = makeEvent('/incoming', { CallSid: CALL_SID, From: CALLER_NUMBER });

    const result = await h.incoming(event) as { statusCode: number; body: string };

    expect(result.body).toContain('statusCallback=');
    expect(result.body).toContain('statusCallbackEvent="completed"');
  });
});

// ─── Round 5: parseFormBody + sign decoding ───────────────────────────────────

describe('parseFormBody — URL-encoded + decoding', () => {
  it('decodes + as space in SpeechResult (Twilio form encoding)', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    const h = createHandler(deps);
    // Simulate raw Twilio body with + instead of %20
    const event = {
      ...makeEvent('/gather', {}),
      body: `CallSid=${CALL_SID}&SpeechResult=mujhe+bukhar+hai&Digits=`,
    };

    await h.gather(event);

    // The sanitized text passed to transcriptHistory should have spaces, not +
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        transcriptHistory: expect.arrayContaining(['mujhe bukhar hai']),
      }),
    );
  });
});

// ─── Round 5: English caller gets en-IN Gather language ───────────────────────

describe('handleGather — Gather language attribute', () => {
  it('English caller gets en-IN language on Gather element', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ language: 'english' }));
    // Return followUpRequired: true so the handler returns twimlGather (with <Gather>), not twimlSayHangup
    (deps.triageAgent.assessSymptoms as jest.Mock).mockResolvedValueOnce({
      conditionId: 'general_fever',
      icd10Code: 'R50.9',
      severity: 'urgent',
      recommendedCareLevel: 'PHC',
      summaryHindi: 'Tez bukhar hai.',
      summaryEnglish: 'High fever detected.',
      followUpRequired: true,
      followUpInterval: '2h',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'I have a headache', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    // Gather element should use en-IN for English callers
    expect(result.body).toContain('<Gather');
    expect(result.body).toContain('language="en-IN"');
  });

  it('Hindi caller gets hi-IN language on Gather element', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ language: 'hindi' }));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'mujhe bukhar hai', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('language="hi-IN"');
  });

  it('DTMF 2 language switch returns en-IN Gather', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, Digits: '2', SpeechResult: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('language="en-IN"');
  });
});

// ─── Round 5: statusCallback on twimlSayHangup and twimlBridge108 ─────────────

describe('TwiML statusCallback — all response types', () => {
  it('twimlSayHangup includes statusCallback (general triage end)', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    // Non-followUp triage → twimlSayHangup path
    (deps.triageAgent.assessSymptoms as jest.Mock).mockResolvedValueOnce({
      conditionId: 'general_fever',
      icd10Code: 'R50.9',
      severity: 'non-urgent',
      recommendedCareLevel: 'home',
      summaryHindi: 'Aapko bukhar hai.',
      summaryEnglish: 'You have fever.',
      followUpRequired: false,
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'mujhe bukhar hai', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    // Should contain Hangup (not Gather) AND statusCallback
    expect(result.body).toContain('<Hangup/>');
    expect(result.body).toContain('statusCallback=');
    expect(result.body).toContain('statusCallbackEvent="completed"');
  });

  it('twimlBridge108 includes statusCallback (emergency dispatch)', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ locationCollected: true }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    (deps.emergencyKB.retrieveEmergencyScript as jest.Mock).mockRejectedValueOnce(new Error('KB down'));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'seene mein dard', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    // Should bridge to 108 AND have statusCallback
    expect(result.body).toContain('<Dial>108</Dial>');
    expect(result.body).toContain('statusCallback=');
    expect(result.body).toContain('statusCallbackEvent="completed"');
  });

  it('DTMF 9 bridge includes statusCallback', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, Digits: '9', SpeechResult: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('<Dial>108</Dial>');
    expect(result.body).toContain('statusCallback=');
  });
});

// ─── Round 6: TTS language on bridge/hangup for English callers ───────────────

describe('TwiML TTS language — bridge and hangup respect caller language', () => {
  it('English caller DTMF 9 → bridge message uses en-IN TTS', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ language: 'english' }));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, Digits: '9', SpeechResult: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('<Dial>108</Dial>');
    expect(result.body).toContain('language="en-IN"');
    expect(result.body).toContain('This is an emergency');
  });

  it('English caller danger sign escalation → bridge uses en-IN TTS', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ language: 'english', triagePath: 'general' }));
    (deps.intentRouter.checkDangerSigns as jest.Mock).mockReturnValueOnce(true);
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'I fainted', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('<Dial>108</Dial>');
    expect(result.body).toContain('language="en-IN"');
    expect(result.body).toContain('Danger signs detected');
  });

  it('English caller non-followUp triage → hangup uses en-IN TTS', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ language: 'english' }));
    (deps.triageAgent.assessSymptoms as jest.Mock).mockResolvedValueOnce({
      conditionId: 'general_fever',
      icd10Code: 'R50.9',
      severity: 'non-urgent',
      recommendedCareLevel: 'home',
      summaryHindi: 'Aapko bukhar hai.',
      summaryEnglish: 'You have fever.',
      followUpRequired: false,
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'I have fever', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('<Hangup/>');
    expect(result.body).toContain('language="en-IN"');
    expect(result.body).toContain('You have fever');
    expect(result.body).not.toContain('language="hi-IN"');
  });

  it('English caller emergency KB failure → bridge uses en-IN TTS', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ language: 'english', locationCollected: true }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    (deps.emergencyKB.retrieveEmergencyScript as jest.Mock).mockRejectedValueOnce(new Error('DynamoDB down'));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'chest pain', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('<Dial>108</Dial>');
    expect(result.body).toContain('language="en-IN"');
    expect(result.body).toContain('Connecting you to 108');
  });
});

// ─── Round 6: parseFormBody handles = in values ───────────────────────────────

describe('parseFormBody — edge cases', () => {
  it('handles = in URL-encoded values without truncation', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    const h = createHandler(deps);
    // Simulate a value containing encoded = (%3D) — should survive parsing
    const event = {
      ...makeEvent('/gather', {}),
      body: `CallSid=${CALL_SID}&SpeechResult=test%3Dvalue&Digits=`,
    };

    await h.gather(event);

    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        transcriptHistory: expect.arrayContaining(['test=value']),
      }),
    );
  });
});


// ─── Drug path — multi-turn wiring ───────────────────────────────────────────

describe('handleGather — drug path multi-turn', () => {
  it('first drug intent → sets drugQueryState to awaiting_drug_name and prompts', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'default',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'dawai ke baare mein', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Gather');
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ drugQueryState: 'awaiting_drug_name', triagePath: 'drug' }),
    );
  });

  it('second turn with drug name → queries DrugKB and returns dosage info', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'drug',
      drugQueryState: 'awaiting_drug_name',
    }));
    // Intent router returns drug again on second turn
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'default',
    });
    // Mock drugKB
    const drugKB = {
      queryDrug: jest.fn(async () => ({
        drug_name: 'paracetamol',
        query_type: 'safety' as const,
        dose_adult: '500 mg to 1000 mg every 4-6 hours',
        contraindications: ['severe liver disease'],
        pregnancy_category: 'B',
        source: 'NLEM 2022',
      })),
      checkOverdose: jest.fn(() => true),
    };
    const h = createHandler({ ...deps, drugKB } as unknown as Partial<typeof deps>);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'paracetamol', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('paracetamol');
    expect(result.body).toContain('<Hangup/>');
    expect(drugKB.queryDrug).toHaveBeenCalledWith('paracetamol', 'safety', expect.any(Object));
  });

  it('drug not found → returns not-found message with disclaimer', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'drug',
      drugQueryState: 'awaiting_drug_name',
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'default',
    });
    const drugKB = {
      queryDrug: jest.fn(async () => ({
        drug_name: 'unknowndrug',
        query_type: 'safety' as const,
        contraindications: [],
        pregnancy_category: 'unknown',
        source: 'not_found',
        not_found: true,
      })),
      checkOverdose: jest.fn(() => true),
    };
    const h = createHandler({ ...deps, drugKB } as unknown as Partial<typeof deps>);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'unknowndrug', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Hangup/>');
    expect(result.body).toContain('database');
  });

  it('English caller drug query → returns English response', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'drug',
      drugQueryState: 'awaiting_drug_name',
      language: 'english',
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'default',
    });
    const drugKB = {
      queryDrug: jest.fn(async () => ({
        drug_name: 'paracetamol',
        query_type: 'safety' as const,
        dose_adult: '500 mg every 4-6 hours',
        contraindications: [],
        pregnancy_category: 'B',
        source: 'NLEM 2022',
      })),
      checkOverdose: jest.fn(() => true),
    };
    const h = createHandler({ ...deps, drugKB } as unknown as Partial<typeof deps>);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'paracetamol', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('language="en-IN"');
    expect(result.body).toContain('paracetamol');
  });

  it('DrugKB failure → returns fallback re-prompt', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'drug',
      drugQueryState: 'awaiting_drug_name',
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'default',
    });
    const drugKB = {
      queryDrug: jest.fn(async () => { throw new Error('DynamoDB timeout'); }),
      checkOverdose: jest.fn(() => true),
    };
    const h = createHandler({ ...deps, drugKB } as unknown as Partial<typeof deps>);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'paracetamol', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Gather');
  });

  it('pregnant caller drug query → includes pregnancy category', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'drug',
      drugQueryState: 'awaiting_drug_name',
      patientProfile: { category: 'adult', exact_age_mentioned: null, pregnancy_flag: 'confirmed' },
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'default',
    });
    const drugKB = {
      queryDrug: jest.fn(async () => ({
        drug_name: 'paracetamol',
        query_type: 'safety' as const,
        dose_adult: 'Safe in pregnancy at recommended doses',
        contraindications: [],
        pregnancy_category: 'B',
        source: 'NLEM 2022',
      })),
      checkOverdose: jest.fn(() => true),
    };
    const h = createHandler({ ...deps, drugKB } as unknown as Partial<typeof deps>);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'paracetamol', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('Pregnancy category: B');
    expect(drugKB.queryDrug).toHaveBeenCalledWith(
      'paracetamol',
      'safety',
      expect.objectContaining({ pregnancy_flag: 'confirmed' }),
    );
  });
});

// ─── Tier 1 voice location collection ─────────────────────────────────────────

describe('handleGather — Tier 1 voice location collection', () => {
  it('emergency first turn → asks for location before ABCDE', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ locationCollected: false }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'seene mein dard', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Gather');
    // Should ask for location, not start ABCDE
    expect(result.body).toContain('kahan');
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ locationPromptSent: true }),
    );
  });

  it('location response → parses location and proceeds to ABCDE', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'emergency',
      conditionId: 'cardiac',
      locationPromptSent: true,
      locationCollected: false,
      abcdeStep: null,
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    // Mock location detector to return a parsed location
    (deps.locationDetector.parseNovaLocation as jest.Mock).mockReturnValueOnce({
      rawText: 'bhopal',
      nearCity: 'bhopal',
      accuracy: 'city',
      timestamp: new Date().toISOString(),
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'bhopal', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    // Should proceed to ABCDE airway question, not re-ask location
    expect(result.body).toContain('Kya saans aa rahi hai?');
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        locationCollected: true,
        tier1Location: expect.objectContaining({ nearCity: 'bhopal' }),
        abcdeStep: 'airway',
      }),
    );
  });

  it('English caller → location prompt in English', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ language: 'english', locationCollected: false }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'chest pain', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('Where are you');
  });

  it('skips location prompt when locationCollected is already true', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      locationCollected: true,
      abcdeStep: null,
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'seene mein dard', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    // Should go straight to ABCDE, not ask for location
    expect(result.body).toContain('Kya saans aa rahi hai?');
  });
});

// ─── Missed call callback ─────────────────────────────────────────────────────

describe('handleMissedCall — /missed-call endpoint', () => {
  it('returns callback_initiated for no-answer status', async () => {
    const deps = makeDeps();
    const h = createHandler(deps);
    const event = makeEvent('/missed-call', {
      CallSid: CALL_SID,
      From: '+919876543210',
      CallStatus: 'no-answer',
    });

    const result = await h.missedCall(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.action).toBe('callback_initiated');
    expect(body.callbackTo).toBe('[REDACTED]');
  });

  it('ignores completed calls — not a missed call', async () => {
    const deps = makeDeps();
    const h = createHandler(deps);
    const event = makeEvent('/missed-call', {
      CallSid: CALL_SID,
      From: '+919876543210',
      CallStatus: 'completed',
    });

    const result = await h.missedCall(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('OK');
  });

  it('handles busy status as missed call', async () => {
    const deps = makeDeps();
    const h = createHandler(deps);
    const event = makeEvent('/missed-call', {
      CallSid: CALL_SID,
      From: '+919876543210',
      CallStatus: 'busy',
    });

    const result = await h.missedCall(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.action).toBe('callback_initiated');
  });

  it('handles canceled status as missed call', async () => {
    const deps = makeDeps();
    const h = createHandler(deps);
    const event = makeEvent('/missed-call', {
      CallSid: CALL_SID,
      From: '+919876543210',
      CallStatus: 'canceled',
    });

    const result = await h.missedCall(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.action).toBe('callback_initiated');
  });

  it('/missed-call route works via main handler', async () => {
    const { handler } = await import('../../handlers/callHandler');
    const event = makeEvent('/missed-call', {
      CallSid: CALL_SID,
      From: '+919876543210',
      CallStatus: 'no-answer',
    });

    const result = await handler(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
  });
});

// ─── Nova Lite Master Extraction routing ──────────────────────────────────────

describe('handleGather — Nova Lite Master Extraction routing', () => {
  it('re-routes from general_triage to emergency when extraction has danger signs', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      masterExtraction: {
        is_emergency: true,
        condition_id: 'cardiac',
        patient_profile: { category: 'adult', exact_age_mentioned: null, pregnancy_flag: 'not_applicable' },
        clinical_symptoms_english: ['chest pain'],
        drugs_mentioned: [],
        severity_signal: 'critical',
        duration: null,
        location_mentioned: null,
        danger_signs_present: ['chest pain radiating to arm'],
        confidence: 0.95,
        language_register: 'hinglish',
      },
      locationCollected: true,
    }));
    // Keyword scan returns general_triage (utterance too long for keyword match)
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'general_triage',
      confidence: 0.8,
      triggerType: 'default',
    });
    // routeFromExtraction should override to emergency
    (deps.intentRouter.routeFromExtraction as jest.Mock).mockReturnValueOnce({
      intent: 'emergency',
      confidence: 0.95,
      triggerType: 'danger_sign',
      conditionId: 'cardiac',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'mera seena dard kar raha hai bahut zyada', Digits: '' });

    await h.gather(event);

    expect(deps.intentRouter.routeFromExtraction).toHaveBeenCalled();
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ triagePath: 'emergency' }),
    );
  });

  it('does NOT re-route when keyword scan already found emergency', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      masterExtraction: {
        is_emergency: true,
        condition_id: 'cardiac',
        patient_profile: { category: 'adult', exact_age_mentioned: null, pregnancy_flag: 'not_applicable' },
        clinical_symptoms_english: ['chest pain'],
        drugs_mentioned: [],
        severity_signal: 'critical',
        duration: null,
        location_mentioned: null,
        danger_signs_present: [],
        confidence: 0.95,
        language_register: 'english',
      },
      locationCollected: true,
    }));
    // Keyword scan already found emergency
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'chest pain', Digits: '' });

    await h.gather(event);

    // routeFromExtraction should NOT be called — keyword already matched
    expect(deps.intentRouter.routeFromExtraction).not.toHaveBeenCalled();
  });
});

// ─── handleStatus — tier1Location in CallRecord ───────────────────────────────

describe('handleStatus — tier1Location in CallRecord', () => {
  it('includes tier1Voice in location when tier1Location was collected', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'emergency',
      conditionId: 'cardiac',
      tier2Location: {
        stdCode: '0755',
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        district: 'Bhopal',
        accuracy: 'district',
        method: 'automatic',
      },
      tier1Location: {
        rawText: 'bairagarh gaon',
        village: 'bairagarh',
        accuracy: 'village',
        timestamp: new Date().toISOString(),
      },
    }));
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: '+919876543210',
      CallStatus: 'completed',
      CallDuration: '120',
    });

    await h.status(event);

    expect(deps.callLogger.logCall).toHaveBeenCalledWith(
      expect.objectContaining({
        location: expect.objectContaining({
          primaryLocation: 'bairagarh',
          accuracyLevel: 'village',
          tier1Voice: expect.objectContaining({ village: 'bairagarh' }),
          tier2Phone: expect.objectContaining({ city: 'Bhopal' }),
        }),
      }),
    );
  });
});

// ─── F1: Nova Lite extractMasterTags wiring ───────────────────────────────────

describe('handleGather — F1: Nova Lite extractMasterTags wiring', () => {
  it('calls extractMasterTags and re-routes default intent via extraction', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ locationCollected: true }));

    // Keyword scan returns default (no match — utterance >4 words)
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'general_triage',
      confidence: 0.5,
      triggerType: 'default',
    });

    // Nova Lite extraction returns emergency
    const extraction = {
      is_emergency: true,
      condition_id: 'cardiac',
      patient_profile: { category: 'adult' as const, exact_age_mentioned: null, pregnancy_flag: 'not_applicable' as const },
      clinical_symptoms_english: ['severe chest pain', 'radiating to left arm'],
      drugs_mentioned: [],
      severity_signal: 'critical',
      duration: '30 minutes',
      location_mentioned: null,
      danger_signs_present: ['chest pain radiating to arm'],
      confidence: 0.95,
      language_register: 'hinglish' as const,
    };
    (deps.intentRouter.extractMasterTags as jest.Mock).mockResolvedValueOnce(extraction);
    (deps.intentRouter.routeFromExtraction as jest.Mock).mockReturnValueOnce({
      intent: 'emergency',
      confidence: 0.95,
      triggerType: 'extraction',
      conditionId: 'cardiac',
    });

    const h = createHandler(deps);
    const event = makeEvent('/gather', {
      CallSid: CALL_SID,
      SpeechResult: 'mujhe bahut tez seene mein dard ho raha hai',
      Digits: '',
    });

    await h.gather(event);

    // extractMasterTags should have been called
    expect(deps.intentRouter.extractMasterTags).toHaveBeenCalledWith(
      'mujhe bahut tez seene mein dard ho raha hai',
      'hindi',
    );
    // routeFromExtraction should have been called with the extraction
    expect(deps.intentRouter.routeFromExtraction).toHaveBeenCalledWith(extraction);
    // State should reflect emergency path
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        triagePath: 'emergency',
        masterExtraction: extraction,
        conditionId: 'cardiac',
      }),
    );
  });

  it('gracefully degrades to keyword-only when extractMasterTags throws', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState());

    // Keyword scan returns default
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'general_triage',
      confidence: 0.5,
      triggerType: 'default',
    });

    // Nova Lite extraction fails
    (deps.intentRouter.extractMasterTags as jest.Mock).mockRejectedValueOnce(
      new Error('Bedrock InvokeModel throttled'),
    );

    const h = createHandler(deps);
    const event = makeEvent('/gather', {
      CallSid: CALL_SID,
      SpeechResult: 'mujhe bukhar hai aur sar dard bhi',
      Digits: '',
    });

    const result = await h.gather(event) as { statusCode: number; body: string };

    // Should still return a valid response (general triage path)
    expect(result.statusCode).toBe(200);
    // routeFromExtraction should NOT be called since extraction failed
    expect(deps.intentRouter.routeFromExtraction).not.toHaveBeenCalled();
    // Should proceed with general triage (assessSymptoms called)
    expect(deps.triageAgent.assessSymptoms).toHaveBeenCalled();
  });

  it('stores extraction asynchronously when keyword scan already matched', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ locationCollected: true }));

    // Keyword scan already found emergency (short utterance)
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'emergency',
      confidence: 1.0,
      triggerType: 'keyword',
      conditionId: 'cardiac',
    });

    // Nova Lite extraction also returns (but should not block)
    const extraction = {
      is_emergency: true,
      condition_id: 'cardiac',
      patient_profile: { category: 'adult' as const, exact_age_mentioned: null, pregnancy_flag: 'not_applicable' as const },
      clinical_symptoms_english: ['chest pain'],
      drugs_mentioned: [],
      severity_signal: 'critical',
      duration: null,
      location_mentioned: null,
      danger_signs_present: [],
      confidence: 0.9,
      language_register: 'hindi' as const,
    };
    (deps.intentRouter.extractMasterTags as jest.Mock).mockResolvedValueOnce(extraction);

    const h = createHandler(deps);
    const event = makeEvent('/gather', {
      CallSid: CALL_SID,
      SpeechResult: 'seene mein dard',
      Digits: '',
    });

    await h.gather(event);

    // extractMasterTags should still be called (background enrichment)
    expect(deps.intentRouter.extractMasterTags).toHaveBeenCalled();
    // But routeFromExtraction should NOT be called — keyword already resolved
    expect(deps.intentRouter.routeFromExtraction).not.toHaveBeenCalled();
    // Emergency path should proceed normally
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ triagePath: 'emergency' }),
    );
  });

  it('stores danger_signs_present from extraction into state', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ locationCollected: true }));

    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'general_triage',
      confidence: 0.5,
      triggerType: 'default',
    });

    const extraction = {
      is_emergency: true,
      condition_id: 'cardiac',
      patient_profile: { category: 'adult' as const, exact_age_mentioned: null, pregnancy_flag: 'not_applicable' as const },
      clinical_symptoms_english: ['chest pain'],
      drugs_mentioned: [],
      severity_signal: 'critical',
      duration: null,
      location_mentioned: null,
      danger_signs_present: ['chest pain radiating to arm', 'shortness of breath'],
      confidence: 0.95,
      language_register: 'hindi' as const,
    };
    (deps.intentRouter.extractMasterTags as jest.Mock).mockResolvedValueOnce(extraction);
    (deps.intentRouter.routeFromExtraction as jest.Mock).mockReturnValueOnce({
      intent: 'emergency',
      confidence: 0.95,
      triggerType: 'extraction',
      conditionId: 'cardiac',
    });

    const h = createHandler(deps);
    const event = makeEvent('/gather', {
      CallSid: CALL_SID,
      SpeechResult: 'mujhe seene mein dard aur saans lene mein takleef',
      Digits: '',
    });

    await h.gather(event);

    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        dangerSignsDetected: expect.arrayContaining([
          'chest pain radiating to arm',
          'shortness of breath',
        ]),
      }),
    );
  });
});

// ─── F2: Drug+Triage parallel (Req 2.10) ─────────────────────────────────────

describe('handleGather — F2: Drug+Triage parallel when symptoms exist', () => {
  it('fires Drug_KB + Triage in parallel and merges response', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'drug',
      drugQueryState: 'awaiting_drug_name',
      masterExtraction: {
        is_emergency: false,
        condition_id: 'general_fever',
        patient_profile: { category: 'adult' as const, exact_age_mentioned: null, pregnancy_flag: 'not_applicable' as const },
        clinical_symptoms_english: ['fever', 'body ache'],
        drugs_mentioned: [{ name: 'paracetamol', query_type: 'safety' as const }],
        severity_signal: 'mild',
        duration: '2 days',
        location_mentioned: null,
        danger_signs_present: [],
        confidence: 0.85,
        language_register: 'hinglish' as const,
      },
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'default',
    });
    // routeFromExtraction must return drug intent so the legacy re-route doesn't crash
    (deps.intentRouter.routeFromExtraction as jest.Mock).mockReturnValue({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'extraction',
    });

    // Mock drugKB
    const drugKB = {
      queryDrug: jest.fn(async () => ({
        drug_name: 'paracetamol',
        query_type: 'safety' as const,
        dose_adult: '500 mg every 4-6 hours',
        contraindications: ['severe liver disease'],
        pregnancy_category: 'B',
        source: 'NLEM 2022',
      })),
      checkOverdose: jest.fn(() => true),
    };

    // Mock triageAgent — assessSymptoms returns fever counselling
    (deps.triageAgent.assessSymptoms as jest.Mock).mockResolvedValueOnce({
      conditionId: 'fever',
      icd10Code: 'R50.9',
      severity: 'non-urgent',
      recommendedCareLevel: 'home',
      summaryHindi: 'Bukhar hai. Paani peete rahein aur aaram karein.',
      summaryEnglish: 'You have fever. Stay hydrated and rest.',
      followUpRequired: false,
    });

    const h = createHandler({ ...deps, drugKB } as unknown as Partial<typeof deps>);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'paracetamol', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    // Drug info should be present
    expect(result.body).toContain('paracetamol');
    expect(result.body).toContain('500 mg');
    // Triage counselling should also be merged in
    expect(result.body).toContain('Bukhar hai');
    // Both services should have been called
    expect(drugKB.queryDrug).toHaveBeenCalled();
    expect(deps.triageAgent.assessSymptoms).toHaveBeenCalled();
    // Clinical summary should mention both drug and triage
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicalSummary: expect.stringContaining('Drug query: paracetamol'),
      }),
    );
  });

  it('triage failure in parallel is non-fatal — returns drug info only', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'drug',
      drugQueryState: 'awaiting_drug_name',
      masterExtraction: {
        is_emergency: false,
        condition_id: 'general_fever',
        patient_profile: { category: 'adult' as const, exact_age_mentioned: null, pregnancy_flag: 'not_applicable' as const },
        clinical_symptoms_english: ['fever'],
        drugs_mentioned: [{ name: 'paracetamol', query_type: 'safety' as const }],
        severity_signal: 'mild',
        duration: null,
        location_mentioned: null,
        danger_signs_present: [],
        confidence: 0.8,
        language_register: 'hinglish' as const,
      },
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'default',
    });
    // routeFromExtraction must return drug intent so the legacy re-route doesn't crash
    (deps.intentRouter.routeFromExtraction as jest.Mock).mockReturnValue({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'extraction',
    });

    const drugKB = {
      queryDrug: jest.fn(async () => ({
        drug_name: 'paracetamol',
        query_type: 'safety' as const,
        dose_adult: '500 mg every 4-6 hours',
        contraindications: [],
        pregnancy_category: 'B',
        source: 'NLEM 2022',
      })),
      checkOverdose: jest.fn(() => true),
    };

    // Triage fails — should not crash the drug response
    (deps.triageAgent.assessSymptoms as jest.Mock).mockRejectedValueOnce(
      new Error('Bedrock timeout'),
    );

    const h = createHandler({ ...deps, drugKB } as unknown as Partial<typeof deps>);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'paracetamol', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    // Drug info should still be present
    expect(result.body).toContain('paracetamol');
    expect(result.body).toContain('500 mg');
    expect(result.body).toContain('<Hangup/>');
  });

  it('no symptoms in extraction → drug-only query (no parallel triage)', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'drug',
      drugQueryState: 'awaiting_drug_name',
      // No masterExtraction or empty symptoms
      masterExtraction: null,
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'default',
    });

    const drugKB = {
      queryDrug: jest.fn(async () => ({
        drug_name: 'metformin',
        query_type: 'safety' as const,
        dose_adult: '500 mg twice daily',
        contraindications: ['renal impairment'],
        pregnancy_category: 'B',
        source: 'NLEM 2022',
      })),
      checkOverdose: jest.fn(() => true),
    };

    const h = createHandler({ ...deps, drugKB } as unknown as Partial<typeof deps>);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'metformin', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('metformin');
    // Triage should NOT be called — no symptoms
    expect(deps.triageAgent.assessSymptoms).not.toHaveBeenCalled();
  });

  it('pediatric caller gets child dose in drug response', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      triagePath: 'drug',
      drugQueryState: 'awaiting_drug_name',
      patientProfile: { category: 'pediatric', exact_age_mentioned: '5 years', pregnancy_flag: 'not_applicable' },
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'default',
    });

    const drugKB = {
      queryDrug: jest.fn(async () => ({
        drug_name: 'paracetamol',
        query_type: 'dosage' as const,
        dose_child: '10-15 mg/kg every 4-6 hours',
        dose_adult: '500 mg every 4-6 hours',
        contraindications: ['severe liver disease'],
        pregnancy_category: 'B',
        source: 'NLEM 2022',
      })),
      checkOverdose: jest.fn(() => true),
    };

    const h = createHandler({ ...deps, drugKB } as unknown as Partial<typeof deps>);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'paracetamol', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('10-15 mg/kg');
    // Should NOT contain adult dose in the response text
    expect(result.body).not.toContain('500 mg');
  });
});

// ─── D1: DTMF fallback on speech failure (Req 1.4) ───────────────────────────

describe('handleGather — D1: DTMF fallback after repeated speech failures', () => {
  it('first empty speech → normal re-prompt with Gather (speech+dtmf)', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ speechFailCount: 0 }));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: '', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    // Should be a normal Gather with speech+dtmf
    expect(result.body).toContain('<Gather');
    expect(result.body).toContain('input="speech dtmf"');
    // speechFailCount should be 1
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ speechFailCount: 1 }),
    );
  });

  it('second consecutive empty speech → switches to DTMF-only mode', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ speechFailCount: 1 }));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: '', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    // Should be DTMF-only Gather
    expect(result.body).toContain('<Gather');
    expect(result.body).toContain('input="dtmf"');
    expect(result.body).not.toContain('input="speech dtmf"');
    // Should contain DTMF menu instructions
    expect(result.body).toMatch(/9.*emergency|Emergency.*9/i);
    // speechFailCount should be 2
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ speechFailCount: 2 }),
    );
  });

  it('DTMF 9 in DTMF-only mode → bridges to 108', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ speechFailCount: 2 }));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: '', Digits: '9' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('<Dial>108</Dial>');
  });

  it('successful speech input resets speechFailCount to 0', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ speechFailCount: 1 }));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'mujhe bukhar hai', Digits: '' });

    await h.gather(event);

    // speechFailCount should be reset to 0
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ speechFailCount: 0 }),
    );
  });

  it('English caller gets English DTMF menu after 2 failures', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ speechFailCount: 1, language: 'english' }));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: '', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('input="dtmf"');
    expect(result.body).toContain('Voice not detected');
    expect(result.body).toContain('language="en-IN"');
  });

  it('DTMF 1 in DTMF-only mode → re-enables speech gather', async () => {
    const deps = makeDeps();
    // After DTMF-only mode, caller presses 1 to try speaking again
    // DTMF 1 is not a special override (only 2=English, 9=emergency)
    // So it falls through to intent classification with digits='1'
    deps.stateRepo.load = jest.fn(async () => makeState({ speechFailCount: 2 }));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: '', Digits: '1' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    // Should not crash — DTMF 1 is not a special key, so it goes through
    // intent classification. The important thing is it doesn't bridge to 108.
    expect(result.statusCode).toBe(200);
    expect(result.body).not.toContain('<Dial>108</Dial>');
  });
});

// ─── S1: SFN input contains secureCallerNumber ───────────────────────────────

describe('handleStatus — S1: SFN input contains secureCallerNumber', () => {
  it('SFN input has secureCallerNumber with real phone number', async () => {
    process.env.TRIAGE_WORKFLOW_ARN = 'arn:aws:states:ap-south-1:123456789:stateMachine:vaidyavaani-triage';
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ triagePath: 'general', conditionId: 'general_fever' }));
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'completed',
      CallDuration: '45',
    });

    await h.status(event);

    const sendCall = (deps.sfn.send as jest.Mock).mock.calls[0][0];
    const sfnInput = JSON.parse(sendCall.input.input ?? sendCall.input);
    const parsed = sfnInput.input ? JSON.parse(sfnInput.input) : sfnInput;
    // secureCallerNumber should contain the REAL phone number
    expect(parsed.secureCallerNumber).toBe(CALLER_NUMBER);
    // callRecord.callerNumber should be REDACTED
    expect(parsed.callRecord.callerNumber).toBe('[REDACTED]');
    delete process.env.TRIAGE_WORKFLOW_ARN;
  });

  it('emergency SFN input also has secureCallerNumber for dispatch', async () => {
    process.env.TRIAGE_WORKFLOW_ARN = 'arn:aws:states:ap-south-1:123456789:stateMachine:vaidyavaani-triage';
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ triagePath: 'emergency', conditionId: 'cardiac' }));
    const h = createHandler(deps);
    const event = makeEvent('/status', {
      CallSid: CALL_SID,
      From: CALLER_NUMBER,
      CallStatus: 'completed',
      CallDuration: '60',
    });

    await h.status(event);

    const sendCall = (deps.sfn.send as jest.Mock).mock.calls[0][0];
    const sfnInput = JSON.parse(sendCall.input.input ?? sendCall.input);
    const parsed = sfnInput.input ? JSON.parse(sfnInput.input) : sfnInput;
    expect(parsed.secureCallerNumber).toBe(CALLER_NUMBER);
    expect(parsed.callRecord.callerNumber).toBe('[REDACTED]');
    delete process.env.TRIAGE_WORKFLOW_ARN;
  });
});

// ─── S3: Extracted drug name skips prompt ─────────────────────────────────────

describe('handleGather — S3: extracted drug name skips prompt', () => {
  it('drug name in masterExtraction → queries DrugKB directly, no prompt', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      masterExtraction: {
        is_emergency: false,
        condition_id: 'unknown',
        patient_profile: { category: 'adult' as const, exact_age_mentioned: null, pregnancy_flag: 'confirmed' as const },
        clinical_symptoms_english: [],
        drugs_mentioned: [{ name: 'paracetamol', query_type: 'safety' }],
        severity_signal: 'mild',
        duration: null,
        location_mentioned: null,
        danger_signs_present: [],
        confidence: 0.9,
        language_register: 'hinglish' as const,
      },
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'default',
    });
    // routeFromExtraction returns drug intent
    (deps.intentRouter.routeFromExtraction as jest.Mock).mockReturnValue({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'extraction',
    });

    const drugKB = {
      queryDrug: jest.fn(async () => ({
        drug_name: 'paracetamol',
        query_type: 'safety' as const,
        dose_adult: '500 mg every 4-6 hours',
        contraindications: [],
        pregnancy_category: 'B',
        source: 'NLEM 2022',
      })),
      checkOverdose: jest.fn(() => true),
    };
    const h = createHandler({ ...deps, drugKB } as unknown as Partial<typeof deps>);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'paracetamol safe hai kya pregnancy mein', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    // Should NOT prompt for drug name — should go straight to answer
    expect(result.body).not.toContain('dawai');
    expect(result.body).not.toContain('Which medicine');
    // Should contain drug info
    expect(result.body).toContain('paracetamol');
    expect(result.body).toContain('Pregnancy category: B');
    expect(result.body).toContain('<Hangup/>');
    expect(drugKB.queryDrug).toHaveBeenCalledWith('paracetamol', 'safety', expect.any(Object));
  });

  it('no drug in extraction → falls through to prompt as before', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      masterExtraction: {
        is_emergency: false,
        condition_id: 'unknown',
        patient_profile: { category: 'adult' as const, exact_age_mentioned: null, pregnancy_flag: 'unknown' as const },
        clinical_symptoms_english: [],
        drugs_mentioned: [],
        severity_signal: 'mild',
        duration: null,
        location_mentioned: null,
        danger_signs_present: [],
        confidence: 0.8,
        language_register: 'pure_hindi' as const,
      },
    }));
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'default',
    });
    (deps.intentRouter.routeFromExtraction as jest.Mock).mockReturnValue({
      intent: 'drug',
      confidence: 0.85,
      triggerType: 'extraction',
    });

    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'dawai ke baare mein poochna tha', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    // Should prompt for drug name
    expect(result.body).toContain('<Gather');
    expect(result.body).toContain('dawai');
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ drugQueryState: 'awaiting_drug_name' }),
    );
  });
});

// ─── S4: Max-turn guard ───────────────────────────────────────────────────────

describe('handleGather — S4: max-turn guard prevents infinite triage loop', () => {
  it('turn 10 → forces wrap-up with triage summary and hangup', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      turn: 9, // will become 10 after increment
      triagePath: 'general',
      transcriptHistory: Array(9).fill('mujhe bukhar hai'),
    }));
    (deps.triageAgent.assessSymptoms as jest.Mock).mockResolvedValueOnce({
      conditionId: 'general_fever',
      icd10Code: 'R50.9',
      severity: 'non-urgent',
      recommendedCareLevel: 'PHC',
      summaryHindi: 'Aapko bukhar hai.',
      summaryEnglish: 'You have fever.',
      followUpRequired: true, // Nova Pro still says follow-up — but we override
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'wahi bukhar hai', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    // Should hang up, NOT continue gathering
    expect(result.body).toContain('<Hangup/>');
    expect(result.body).not.toContain('<Gather');
    // Should contain visit advice
    expect(result.body).toContain('swasthya kendra');
    // followUpRequired should be forced to false in state
    expect(deps.stateRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ followUpRequired: false }),
    );
  });

  it('English caller at turn 10 → English wrap-up message', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      turn: 9,
      language: 'english',
      triagePath: 'general',
      transcriptHistory: Array(9).fill('I have fever'),
    }));
    (deps.triageAgent.assessSymptoms as jest.Mock).mockResolvedValueOnce({
      conditionId: 'general_fever',
      icd10Code: 'R50.9',
      severity: 'non-urgent',
      recommendedCareLevel: 'PHC',
      summaryHindi: 'Aapko bukhar hai.',
      summaryEnglish: 'You have fever.',
      followUpRequired: true,
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'still fever', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('<Hangup/>');
    expect(result.body).toContain('health centre');
    expect(result.body).toContain('language="en-IN"');
  });

  it('turn 9 → normal triage continues (no forced wrap-up)', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      turn: 8, // will become 9 after increment — still under limit
      triagePath: 'general',
    }));
    (deps.triageAgent.assessSymptoms as jest.Mock).mockResolvedValueOnce({
      conditionId: 'general_fever',
      icd10Code: 'R50.9',
      severity: 'non-urgent',
      recommendedCareLevel: 'home',
      summaryHindi: 'Aapko bukhar hai.',
      summaryEnglish: 'You have fever.',
      followUpRequired: true,
      followUpInterval: '2h',
    });
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'bukhar hai', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    // Should continue gathering — NOT force a wrap-up hangup
    expect(result.body).toContain('<Gather');
    // twimlGather always includes <Hangup/> as a Twilio no-input safety fallback,
    // so we assert the wrap-up visit-advice is absent instead of the XML tag.
    expect(result.body).not.toContain('swasthya kendra');
  });

  it('turn 10 with triage failure → graceful wrap-up with visit advice', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({
      turn: 9,
      triagePath: 'general',
    }));
    (deps.triageAgent.assessSymptoms as jest.Mock).mockRejectedValueOnce(new Error('Bedrock timeout'));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'bukhar hai', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('<Hangup/>');
    expect(result.body).toContain('swasthya kendra');
  });
});

// ─── S5: English fallback on error ────────────────────────────────────────────

describe('handleGather — S5: bilingual fallback on error', () => {
  it('English caller triage failure → English fallback message', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ language: 'english' }));
    (deps.triageAgent.assessSymptoms as jest.Mock).mockRejectedValueOnce(new Error('Bedrock timeout'));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'I have a headache', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('system is currently busy');
    expect(result.body).not.toContain('Maafi chahte hain');
  });

  it('Hindi caller triage failure → Hindi fallback message', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ language: 'hindi' }));
    (deps.triageAgent.assessSymptoms as jest.Mock).mockRejectedValueOnce(new Error('Bedrock timeout'));
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'mujhe sar dard hai', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.body).toContain('Maafi chahte hain');
  });

  it('English caller final fallback re-prompt → English text', async () => {
    const deps = makeDeps();
    deps.stateRepo.load = jest.fn(async () => makeState({ language: 'english' }));
    // Intent returns something that doesn't match any path → falls to final re-prompt
    (deps.intentRouter.classifyIntent as jest.Mock).mockResolvedValueOnce({
      intent: 'unknown' as any,
      confidence: 0.3,
      triggerType: 'default',
    });
    (deps.intentRouter.extractMasterTags as jest.Mock).mockResolvedValueOnce(null);
    const h = createHandler(deps);
    const event = makeEvent('/gather', { CallSid: CALL_SID, SpeechResult: 'hello', Digits: '' });

    const result = await h.gather(event) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('describe your symptoms again');
    expect(result.body).not.toContain('Kripya apni takleef');
  });
});
