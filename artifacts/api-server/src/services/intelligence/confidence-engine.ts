// artifacts/api-server/src/services/intelligence/confidence-engine.ts
import { AnalysisResponse } from '../schema/analysis.schema';
import { RoutingContext } from '../../config/providers.config';

export interface ConfidenceFactors {
  modelReported?: number;
  categoryClarity: number;
  ingredientCompleteness: number;
  uncertaintyNoteCount: number;
  ocrConfidence: number;
  imageComplexity: 'low' | 'medium' | 'high';
  beverageVsCookingClarity: number;
}

export function assessConfidence(
  response: AnalysisResponse,
  context: Partial<RoutingContext> = {}
): number {
  const factors: ConfidenceFactors = {
    modelReported: response.confidenceScore,
    categoryClarity: response.category !== 'unknown' ? 1.0 : 0.3,
    ingredientCompleteness: response.composition?.ingredients?.length > 0 ? 0.9 : 0.5,
    uncertaintyNoteCount: response.uncertaintyNotes?.length || 0,
    ocrConfidence: context.ocrConfidence || 0.8,
    imageComplexity: context.imageComplexity || 'medium',
    beverageVsCookingClarity: response.liquidType !== undefined ? 1.0 : 0.5,
  };

  // Start with model-reported confidence if available
  let confidence = factors.modelReported ?? 0.8;

  // Adjust for category clarity
  confidence *= factors.categoryClarity;

  // Adjust for ingredient completeness
  confidence *= 0.9 + (factors.ingredientCompleteness * 0.1);

  // Penalize for uncertainty notes
  confidence -= factors.uncertaintyNoteCount * 0.05;

  // Adjust for OCR confidence
  confidence *= 0.8 + (factors.ocrConfidence * 0.2);

  // Adjust for image complexity
  if (factors.imageComplexity === 'high') confidence *= 0.9;
  if (factors.imageComplexity === 'low') confidence *= 1.05;

  // Bonus for clear beverage/cooking classification
  confidence *= 0.95 + (factors.beverageVsCookingClarity * 0.05);

  // Clamp to valid range
  return Math.max(0.3, Math.min(1.0, confidence));
}

export function shouldEscalateBasedOnConfidence(
  confidence: number,
  context: RoutingContext
): boolean {
  // Base threshold from env
  const threshold = 0.75;

  // Lower threshold for pro users (they expect higher quality)
  if (context.userTier === 'pro' || context.userTier === 'elite') {
    return confidence < threshold + 0.05; // Actually higher quality means we escalate sooner if confidence is low
  }

  // Higher threshold for ambiguous scans
  if (context.scanType === 'ambiguous') {
    return confidence < threshold + 0.1;
  }

  return confidence < threshold;
}
