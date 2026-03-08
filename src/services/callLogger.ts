import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { CallRecord, RedactedCallRecord, FHIRCondition, TriageResult } from '../models/types';
import { ICallLogger } from '../interfaces/ICallLogger';
import { S3Key, AudioStream } from '../models/enums';
import { Logger } from '../utils/logger';
import { generateFHIRRecord } from './fhirGenerator';

const CALLS_TABLE = 'vaidyavaani-calls';
const TTL_90_DAYS = 90 * 24 * 60 * 60; // seconds

// ─── PII Redaction ────────────────────────────────────────────────────────────

const PII_PATTERNS: RegExp[] = [
  /\+91[-\s]?\d{10}/g,          // +91-9XXXXXXXXXX
  /\b91\d{10}\b/g,              // 919XXXXXXXXXX
  /\b0\d{2,4}[-\s]\d{6,8}\b/g, // landline 0XXX-XXXXXXX (before mobile — more specific)
  /\b\d{4}\s\d{4}\s\d{4}\b/g,  // Aadhaar: XXXX XXXX XXXX (before mobile — more specific)
  /\b\d{12}\b/g,                // Aadhaar without spaces (before mobile — 12 digits)
  /\b[6-9]\d{9}\b/g,            // 10-digit mobile (last — least specific)
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, // email
];

/**
 * Redacts PII from any string value.
 * Replaces all matching patterns with [REDACTED].
 * Pattern order matters: longer/more-specific patterns first to avoid
 * partial matches from shorter patterns mangling the longer ones.
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
 * Also deep-redacts PII from location.tier1Voice.rawText (DPDP Act compliance).
 * Scenario: caller says "main 9876543210 se bol raha hoon, Bhopal mein hoon"
 * — the phone number in rawText must be redacted before DynamoDB write.
 */
export function redactCallRecord(record: CallRecord): RedactedCallRecord {
  const redacted: RedactedCallRecord = {
    ...record,
    callerNumber: '[REDACTED]',
  };

  // Deep-redact PII from voice location raw text
  if (redacted.location?.tier1Voice?.rawText) {
    redacted.location = {
      ...redacted.location,
      tier1Voice: {
        ...redacted.location.tier1Voice,
        rawText: redactPII(redacted.location.tier1Voice.rawText),
      },
    };
  }

  return redacted;
}


// ─── Call Logger Service ─────────────────────────────────────────────────────

/**
 * CallLoggerService implements ICallLogger.
 * Follows the interface-first DI pattern used by all VaidyaVaani services.
 * DynamoDB client is injected for testability.
 */
export class CallLoggerService implements ICallLogger {
  private dynamo: DynamoDBClient;

  constructor(dynamo?: DynamoDBClient) {
    this.dynamo = dynamo ?? new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
  }

  /**
   * Persists a redacted call record to DynamoDB.
   * Sets TTL = now + 90 days (DPDP Act compliance, Req 8.4).
   * callerNumber is always redacted before write (Req 8.3, 9.7).
   *
   * IMPORTANT: Logging failures are caught and logged but NOT re-thrown.
   * The caller already received their triage — a logging failure should
   * not crash the call or trigger 108 bridge fallback unnecessarily.
   */
  async logCall(callRecord: CallRecord): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + TTL_90_DAYS;
    const redacted = redactCallRecord(callRecord);

    const item = {
      callId:                 redacted.callId,
      ttl,
      timestamp:              redacted.timestamp,
      duration:               redacted.duration,
      callerNumber:           redacted.callerNumber,  // always '[REDACTED]'
      callSourceType:         redacted.callSourceType,
      language:               redacted.language,
      triageOutcome:          redacted.triageOutcome,
      conditionId:            redacted.conditionId,    // for QuickSight analytics (Req 2.11)
      icd10Code:              redacted.icd10Code,
      severityClassification: redacted.severityClassification,
      dispatchType:           redacted.dispatchType,
      actionsTaken:           redacted.actionsTaken,
      location:               redacted.location,
      recordingS3Key:         redacted.recordingS3Key,
      bedrockTraceId:         redacted.bedrockTraceId,
      fhirRecord:             redacted.fhirRecord,
    };

    try {
      await this.dynamo.send(new PutItemCommand({
        TableName: CALLS_TABLE,
        Item: marshall(item, { removeUndefinedValues: true }),
      }));
      Logger.info('Call logged', { callId: callRecord.callId, triageOutcome: callRecord.triageOutcome });
    } catch (err) {
      // Log but do NOT re-throw — caller already got their triage.
      // Re-throwing here would trigger 108 bridge fallback on emergency paths,
      // which is wrong because the emergency was already handled.
      Logger.error('Failed to log call to DynamoDB — call data lost', {
        callId: callRecord.callId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Stores call recording in S3 with KMS encryption.
   * Hackathon: returns a deterministic key without uploading.
   * Production: upload audio buffer to S3 with KMS encryption.
   */
  async storeRecording(callId: string, _audioStream: AudioStream): Promise<S3Key> {
    // Hackathon stub — no actual S3 upload
    const date = new Date().toISOString().substring(0, 10);
    const key = `recordings/${date}/${callId}.mp3`;
    Logger.info('Recording stored (stub)', { callId, key });
    return key;
  }

  /**
   * Redacts PII from a CallRecord.
   * Delegates to the module-level redactCallRecord function.
   */
  redactPII(record: CallRecord): RedactedCallRecord {
    return redactCallRecord(record);
  }

  /**
   * Generates a FHIR R4 Condition resource from a TriageResult.
   * Delegates to the pure fhirGenerator function.
   */
  generateFHIRRecord(triageResult: TriageResult): FHIRCondition {
    return generateFHIRRecord(
      triageResult.icd10Code,
      triageResult.severity,
      new Date().toISOString(),
    );
  }
}

// ─── Standalone helpers (backward compat + direct use) ───────────────────────

/**
 * Standalone logCall for backward compatibility with existing tests.
 * Uses a default DynamoDBClient. Prefer CallLoggerService for production.
 */
export async function logCall(callRecord: CallRecord): Promise<void> {
  const service = new CallLoggerService();
  return service.logCall(callRecord);
}

/**
 * Builds the S3 key path for a call recording.
 * Pure function — no AWS calls.
 */
export function buildRecordingS3Key(callId: string, callDate: string): string {
  const date = callDate.substring(0, 10); // YYYY-MM-DD
  return `recordings/${date}/${callId}.mp3`;
}
