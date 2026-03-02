import { Logger } from '../utils/logger';

interface ErrorResponse {
  statusCode: number;
  body: string;
  errorType: string;
}

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
          statusCode: 500,
          body: JSON.stringify({ fallbackAction: 'bridge_108' }),
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
