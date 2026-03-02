import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { CallRecord, RedactedCallRecord, FHIRCondition, LocationData } from '../models/types';
import { Logger } from '../utils/logger';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
const CALLS_TABLE = 'vaidyavaani-calls';
const TTL_90_DAYS = 90 * 24 * 60 * 60; // seconds

// ─── PII Redaction ────────────────────────────────────────────────────────────

const PII_PATTERNS: RegExp[] = [
  /\+91[-\s]?\d{10}/g,          // +91-9XXXXXXXXXX
  /\b91\d{10}\b/g,              // 919XXXXXXXXXX
  /\b[6-9]\d{9}\b/g,            // 10-digit mobile
  /\b0\d{2,4}[-\s]\d{6,8}\b/g, // landline 0XXX-XXXXXXX
  /\b\d{4}\s\d{4}\s\d{4}\b/g,  // Aadhaar: XXXX XXXX XXXX
  /\b\d{12}\b/g,                // Aadhaar without spaces
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, // email
];

/**
 * Redacts PII from any string value.
 * Replaces all matching patterns with [REDACTED].
 */
export function redactPII(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

/**
 * Produces a RedactedCallRecord safe for DynamoDB storage.
 * callerNumber is always [REDACTED] — never stored raw.
 */
export function redactCallRecord(record: CallRecord): RedactedCallRecord {
  return {
    ...record,
    callerNumber: '[REDACTED]',
  };
}

// ─── Call Logger ──────────────────────────────────────────────────────────────

export interface LogCallInput {
  callId: string;
  callStartTime: string;
  callEndTime: string;
  durationSeconds: number;
  callerNumber: string;
  callSourceType: 'mobile' | 'landline' | 'unknown';
  language: string;
  triageOutcome: string;
  icd10Code: string;
  severityClassification: string;
  conditionId: string;
  dispatchType: '108' | '102' | 'none';
  actionsTaken: string[];
  location: LocationData;
  recordingS3Key: string;
  bedrockTraceId: string;
  fhirRecord: FHIRCondition;
}

/**
 * Persists a redacted call record to DynamoDB.
 * Sets TTL = now + 90 days (DPDP Act compliance, Req 8.4).
 * callerNumber is always redacted before write (Req 8.3, 9.7).
 */
export async function logCall(input: LogCallInput): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + TTL_90_DAYS;

  const item = {
    callId:                input.callId,
    ttl,
    timestamp:             input.callEndTime,
    callStartTime:         input.callStartTime,
    duration:              input.durationSeconds,
    callerNumber:          '[REDACTED]',           // never store raw number
    callSourceType:        input.callSourceType,
    language:              input.language,
    triageOutcome:         input.triageOutcome,
    icd10Code:             input.icd10Code,
    severityClassification: input.severityClassification,
    conditionId:           input.conditionId,
    dispatchType:          input.dispatchType,
    actionsTaken:          input.actionsTaken,
    location:              input.location,
    recordingS3Key:        input.recordingS3Key,
    bedrockTraceId:        input.bedrockTraceId,
    fhirRecord:            input.fhirRecord,
  };

  try {
    await dynamo.send(new PutItemCommand({
      TableName: CALLS_TABLE,
      Item: marshall(item, { removeUndefinedValues: true }),
    }));
    Logger.info('Call logged', { callId: input.callId, triageOutcome: input.triageOutcome });
  } catch (err) {
    Logger.error('Failed to log call to DynamoDB', {
      callId: input.callId,
      error: (err as Error).message,
    });
    throw err;
  }
}

/**
 * Stub for S3 recording storage.
 * Production: upload audio buffer to S3 with KMS encryption.
 * Hackathon: returns a deterministic key without uploading.
 */
export function buildRecordingS3Key(callId: string, callDate: string): string {
  const date = callDate.substring(0, 10); // YYYY-MM-DD
  return `recordings/${date}/${callId}.mp3`;
}
