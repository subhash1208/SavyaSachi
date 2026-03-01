import { CallRecord, RedactedCallRecord, TriageResult, FHIRCondition } from '../models/types';
import { S3Key, AudioStream } from '../models/enums';

export interface ICallLogger {
  logCall(callRecord: CallRecord): Promise<void>;
  storeRecording(callId: string, audioStream: AudioStream): Promise<S3Key>;
  redactPII(record: CallRecord): RedactedCallRecord;
  generateFHIRRecord(triageResult: TriageResult): FHIRCondition;
}
