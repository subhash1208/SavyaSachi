import { TriageContext, VisualAssessment, SnakeIdentification, WoundAssessment } from '../models/types';
import { ImageData } from '../models/enums';
import { IMultimodalVision } from '../interfaces/IMultimodalVision';

/**
 * MultimodalVisionService — DEFERRED (production phase)
 *
 * WhatsApp photo analysis via Claude Vision on Bedrock.
 * Stalled per project decision: photo feature deferred to production.
 * Chronic care (Task 14.1-14.3) does not depend on this service.
 *
 * When implemented, this will handle:
 * - Snake species identification (India's Big Four)
 * - Wound severity assessment
 * - General visual triage (skin conditions, rashes)
 *
 * Req 10.1-10.4: Multimodal photo analysis via WhatsApp + Claude Vision.
 */
export class MultimodalVisionService implements IMultimodalVision {

  async analyzeImage(_imageData: ImageData, _context: TriageContext): Promise<VisualAssessment> {
    throw new Error('MultimodalVisionService.analyzeImage: not implemented — deferred to production phase');
  }

  async identifySnakeSpecies(_imageData: ImageData): Promise<SnakeIdentification> {
    throw new Error('MultimodalVisionService.identifySnakeSpecies: not implemented — deferred to production phase');
  }

  async assessWound(_imageData: ImageData): Promise<WoundAssessment> {
    throw new Error('MultimodalVisionService.assessWound: not implemented — deferred to production phase');
  }
}
