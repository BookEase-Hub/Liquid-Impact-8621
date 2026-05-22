// artifacts/api-server/src/services/providers/fallback-provider.ts
import { AIRequest } from '../ai-router';
import { generateScanId, AnalysisResponse } from '../schema/analysis.schema';
import { logger } from '../../lib/logger';

export async function getFallbackResponse(req: AIRequest): Promise<AnalysisResponse> {
  logger.warn({ requestId: req.requestId }, 'Using fallback response - AI providers unavailable');

  const detectedProduct = extractProductNameFromPrompt(req.userPrompt) || 'Unknown Beverage';
  const isLikelyBeverage = !req.userPrompt.toLowerCase().includes('cooking') &&
                           !req.userPrompt.toLowerCase().includes('oil');

  return {
    id: generateScanId(),
    detectedProduct,
    brand: null,
    category: isLikelyBeverage ? 'unknown' : 'cooking_oil',
    liquidType: isLikelyBeverage ? 'beverage' : 'cooking_oil',
    confidenceScore: 0.3,
    isBeverage: isLikelyBeverage,
    composition: {
      calories: 0,
      sugarGrams: 0,
      caffeineMg: 0,
      sodiumMg: 0,
      fatGrams: 0,
      proteinGrams: 0,
      additives: [],
      artificialSweeteners: false,
      servingSize: 240,
      servingUnit: 'ml',
      ingredients: [],
    },
    impactScore: 50,
    status: 'stable',
    hydrationLevel: isLikelyBeverage ? 50 : 10,
    glycemicImpact: 'medium',
    dehydrationRisk: false,
    shortTermImpact: {
      energyResponse: 'Analysis unavailable - please retry scan',
      bloodSugarResponse: 'Analysis unavailable',
      bodyReaction: 'Analysis unavailable',
      hydrationImpact: 'Analysis unavailable',
    },
    mediumTermImpact: {
      energyStability: 'Analysis unavailable',
      physicalChanges: 'Analysis unavailable',
      habitRisk: 'Analysis unavailable',
      sleepQuality: 'Analysis unavailable',
    },
    longTermImpact: {
      healthTrend: 'Analysis unavailable',
      metabolicImpact: 'Analysis unavailable',
      riskAccumulation: 'Analysis unavailable',
      nutritionalBalance: 'Analysis unavailable',
    },
    viralStatement: 'Track your drinks with Liquid Impact',
    tiktokHook: 'What\'s in your drink? 🥤',
    aiInsight: 'Scan failed - please ensure good lighting and try again',
    aiSummary: 'We couldn\'t analyze this drink. This might be due to poor image quality or a temporary service issue.',
    uncertaintyNotes: ['Fallback mode: AI providers unavailable', 'Please retry with clearer image'],
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
