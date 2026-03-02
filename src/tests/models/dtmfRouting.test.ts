import * as fc from 'fast-check';
import { DTMFAction } from '../../models/enums';

// Pure routing function — will live in intentRouter service (Task 2)
// Defined here to validate the property before the service is built
function handleDTMF(key: number): DTMFAction {
  switch (key) {
    case 9: return 'emergency';
    case 2: return 'english';
    case 1: return 'hindi';
    default: return 'unknown';
  }
}

/**
 * Property 18: DTMF key routing correctness
 * For any valid DTMF key input, handleDTMF shall return the correct routing action.
 * No valid DTMF key shall produce an undefined or null action.
 * Validates: Requirements 1.3
 */
describe('Property 18: DTMF key routing correctness', () => {
  test('key 9 always routes to emergency', () => {
    expect(handleDTMF(9)).toBe('emergency');
  });

  test('key 2 always routes to english', () => {
    expect(handleDTMF(2)).toBe('english');
  });

  test('key 1 always routes to hindi', () => {
    expect(handleDTMF(1)).toBe('hindi');
  });

  test('any DTMF key (0-9) never returns undefined or null', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9 }), (key) => {
        const result = handleDTMF(key);
        return result !== undefined && result !== null;
      }),
      { numRuns: 100 }
    );
  });

  test('any integer input never throws or returns undefined', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 100 }), (key) => {
        const result = handleDTMF(key);
        return result !== undefined && result !== null;
      }),
      { numRuns: 100 }
    );
  });
});
