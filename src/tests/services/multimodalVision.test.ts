/**
 * VaidyaVaani — MultimodalVisionService Tests
 *
 * NOTE: multimodalVision.ts is a stub service in the Twilio+Polly prototype.
 * The full WhatsApp photo-to-diagnosis path requires Amazon Nova Sonic +
 * Amazon Connect (blocked by AISPL — see BLOCKERS-AND-DECISIONS.md).
 *
 * These tests document the expected contract so the implementation gap is
 * visible in CI and the production implementation has a clear target spec.
 *
 * Real-world scenario: A caller photographs a skin rash or a snake and WhatsApps
 * the image. Nova Vision analyses the photo and routes to the appropriate triage
 * path — snakebite ID triggers the emergency ABCDE script; rash triggers general
 * triage with visual context enriching the Nova Pro prompt.
 */

describe('MultimodalVisionService — contract spec (stub)', () => {
    it.todo('analyses snake image and returns snakebite conditionId');
    it.todo('analyses rash image and returns dermatology symptoms in English');
    it.todo('returns null gracefully when image is too blurry to analyse');
    it.todo('rejects images larger than 5 MB with an appropriate error');
    it.todo('strips EXIF metadata (location) before sending to Bedrock');
});
