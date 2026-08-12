// artifacts/api-server/src/services/providers/fallback-provider.ts
import { AIRequest } from '../ai-router';
import { generateScanId, AnalysisResponse } from '../schema/analysis.schema';
import { logger } from '../../lib/logger';

export async function getFallbackResponse(req: AIRequest): Promise<AnalysisResponse> {
  logger.warn({ requestId: req.requestId }, 'Using fallback response - AI providers unavailable');

  const detectedProduct = extractProductNameFromPrompt(req.userPrompt) || 'Unidentified food or drink';
  const isLikelyBeverage = !req.userPrompt.toLowerCase().includes('cooking') &&
                           !req.userPrompt.toLowerCase().includes('food') &&
                           !req.userPrompt.toLowerCase().includes('meal');

  return {
    id: generateScanId(),
    detectedProduct,
    brand: null,
    category: isLikelyBeverage ? 'unknown' : 'cooking_oil',
    liquidType: isLikelyBeverage ? 'beverage' : 'cooking_oil',
    consumableType: isLikelyBeverage ? 'beverage' : 'condiment',
    confidenceScore: 0.3,
    isBeverage: isLikelyBeverage,
    composition: {
      calories: null,
      sugarGrams: null,
      caffeineMg: null,
      sodiumMg: null,
      fatGrams: null,
      proteinGrams: null,
      fiberGrams: null,
      additives: [],
      artificialSweeteners: false,
      servingSize: 1,
      servingUnit: 'piece',
      ingredients: [],
    },
    impactScore: 0,
    status: 'unknown',
    hydrationLevel: 0,
    glycemicImpact: 'moderate',
    dehydrationRisk: false,
    shortTermImpact: {
      energyResponse: `The effect of ${detectedProduct} cannot be estimated until the item is identified with higher confidence.`,
      bloodSugarResponse: `Blood-sugar response for ${detectedProduct} is uncertain because its ingredients are not visible.`,
      bodyReaction: `The body response to ${detectedProduct} depends on ingredients and portion size that could not be confirmed.`,
      hydrationImpact: `Hydration impact from ${detectedProduct} is unavailable without a reliable classification.`,
    },
    mediumTermImpact: {
      energyStability: `Regular use of ${detectedProduct} cannot be assessed until its composition is known.`,
      physicalChanges: `Portion and nutrient data for ${detectedProduct} are insufficient for a meaningful estimate.`,
      habitRisk: `Habit risk from ${detectedProduct} is unknown because caffeine, sugar, and alcohol were not confirmed.`,
      sleepQuality: `Sleep effects of ${detectedProduct} are unknown until its stimulant and sugar content are identified.`,
    },
    longTermImpact: {
      healthTrend: `Long-term wellness effects of ${detectedProduct} cannot be projected from this image.`,
      metabolicImpact: `Metabolic impact of ${detectedProduct} is uncertain without verified nutrition.`,
      riskAccumulation: `Risk accumulation for ${detectedProduct} cannot be estimated responsibly at this confidence level.`,
      nutritionalBalance: `Nutritional balance for ${detectedProduct} is unavailable until its ingredients are confirmed.`,
    },
    viralStatement: `A clearer image is needed to identify ${detectedProduct}`,
    tiktokHook: 'Try a clearer photo',
    aiInsight: `We could not confidently identify ${detectedProduct}. Retake the photo in brighter light with the full item visible.`,
    uncertaintyNotes: ['Fallback mode: AI providers unavailable', 'Please retry with clearer image'],
    nutritionEstimateUnavailable: true,
    disclaimer: 'For informational purposes only. Not medical advice.',
    alternatives: [],
    metadata: {
      providerUsed: 'fallback',
      processingTimeMs: 10,
      estimatedCost: 0,
    },
  };
}

function extractProductNameFromPrompt(prompt: string): string | null {
  const match = prompt.match(/["']([^"']{2,50})["']/);
  return match?.[1] || null;
}
