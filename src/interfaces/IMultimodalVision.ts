import { TriageContext, VisualAssessment, SnakeIdentification, WoundAssessment } from '../models/types';
import { ImageData } from '../models/enums';

export interface IMultimodalVision {
  analyzeImage(imageData: ImageData, context: TriageContext): Promise<VisualAssessment>;
  identifySnakeSpecies(imageData: ImageData): Promise<SnakeIdentification>;
  assessWound(imageData: ImageData): Promise<WoundAssessment>;
}
