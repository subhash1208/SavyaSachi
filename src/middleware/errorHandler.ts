import { Logger } from '../utils/logger';

interface ErrorResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  errorType: string;
}

/**
 * TwiML fallback for emergency path failures.
 * Returns a valid TwiML response that bridges to 108 so Twilio can parse it.
 * This is critical — if we return JSON, Twilio drops the call and the caller
 * hears silence during a life-threatening emergency.
 */
const EMERGENCY_TWIML_FALLBACK = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="hi-IN">System mein samasya hai. Aapko 108 se jod rahe hain.</Say>
  <Say voice="Polly.Aditi" language="en-IN">There is a technical issue. Connecting you to emergency services now.</Say>
  <Dial>108</Dial>
</Response>`;

export function withErrorHandler<TEvent, TResult>(
  handlerName: string,
  handler: (event: TEvent) => Promise<TResult>,
  options?: { isEmergencyPath?: boolean }
): (event: TEvent) => Promise<TResult | ErrorResponse> {
  return async (event: TEvent) => {
    try {
      return await handler(event);
    } catch (error) {
      Logger.error(`[${handlerName}] Unhandled error`, { error, event });

      if (options?.isEmergencyPath) {
        Logger.critical(`[${handlerName}] Emergency path failure — triggering 108 fallback`);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/xml' },
          body: EMERGENCY_TWIML_FALLBACK,
          errorType: 'EMERGENCY_FALLBACK'
        } as unknown as TResult;
      }

      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal server error', handler: handlerName }),
        errorType: error instanceof Error ? error.name : 'UnknownError'
      } as unknown as TResult;
    }
  };
}
