// artifacts/api-server/src/services/normalization/output-normalizer.ts
import { AnalysisResponse } from '../schema/analysis.schema';
import { AIProvider } from '../../config/providers.config';

export function normalizeProviderOutput(
  raw: any,
  provider: AIProvider
): Partial<AnalysisResponse> {
  let normalized: Partial<AnalysisResponse> = { ...raw };

  // Ensure ID format
  if (!normalized.id || !normalized.id.startsWith('scan_')) {
    normalized.id = `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  // Provider-specific adjustments
  switch (provider) {
    case 'gemini':
      normalized = normalizeGeminiOutput(normalized);
      break;
    case 'openai':
      normalized = normalizeOpenAIOutput(normalized);
      break;
    case 'fallback':
      // Already normalized by construction
      break;
  }

  // Ensure beverage classification consistency
  if (normalized.category && !normalized.liquidType) {
    const cookingLiquids = ['cooking_oil', 'olive_oil', 'vegetable_oil', 'vinegar', 'syrup', 'extract', 'hot_sauce'];
    normalized.liquidType = cookingLiquids.includes(normalized.category) ? 'cooking_oil' : 'beverage';
  }

  // Ensure impact scores are in valid range
  if (normalized.impactScore !== undefined) {
    normalized.impactScore = Math.max(0, Math.min(100, Math.round(normalized.impactScore)));
  }
  if (normalized.hydrationLevel !== undefined) {
    normalized.hydrationLevel = Math.max(0, Math.min(100, Math.round(normalized.hydrationLevel)));
  }

  // Add provider metadata
  normalized.metadata = {
    ...normalized.metadata,
    providerUsed: provider,
  };

  return normalizeToneAndScores(normalized as AnalysisResponse);
}

function normalizeGeminiOutput(raw: any): Partial<AnalysisResponse> {
  // Gemini sometimes returns numbers as strings
  const numericFields = ['impactScore', 'confidenceScore', 'hydrationLevel'];
  for (const field of numericFields) {
    if (raw[field] !== undefined && typeof raw[field] === 'string') {
      raw[field] = parseFloat(raw[field]) || 0;
    }
  }

  if (raw.composition) {
      const compNumericFields = ['calories', 'sugarGrams', 'caffeineMg', 'sodiumMg', 'fatGrams', 'proteinGrams', 'servingSize'];
      for (const field of compNumericFields) {
          if (raw.composition[field] !== undefined && typeof raw.composition[field] === 'string') {
              raw.composition[field] = parseFloat(raw.composition[field]) || 0;
          }
      }
  }

  // Gemini may use slightly different field names
  if (raw.aiSummary && !raw.aiInsight) {
    raw.aiInsight = raw.aiSummary;
  }

  return raw;
}

function normalizeOpenAIOutput(raw: any): Partial<AnalysisResponse> {
  // OpenAI is usually well-formed, but ensure types
  const numericFields = ['impactScore', 'confidenceScore', 'hydrationLevel'];
  for (const field of numericFields) {
    if (raw[field] !== undefined && typeof raw[field] === 'string') {
      raw[field] = parseFloat(raw[field]) || 0;
    }
  }

  return raw;
}

/**
 * Normalize tone and scores across providers
 */
function normalizeToneAndScores(response: AnalysisResponse): AnalysisResponse {
  // Ensure uncertainty language is consistent
  if (response.confidenceScore < 0.7 && !response.uncertaintyNotes?.length) {
    response.uncertaintyNotes = ['Low confidence in classification'];
  }

  // Ensure disclaimer is present for health-related content
  if (!response.disclaimer && response.category !== 'water') {
    response.disclaimer = 'For informational purposes only. Not medical advice.';
  }

  // Ensure glycemic impact mapping is consistent
  if (response.composition?.sugarGrams !== undefined) {
    const sugar = response.composition.sugarGrams;
    if (sugar > 20) response.glycemicImpact = 'very_high';
    else if (sugar > 10) response.glycemicImpact = 'high';
    else if (sugar > 5) response.glycemicImpact = 'moderate';
    else response.glycemicImpact = 'low';
  }

  // Ensure status mapping is consistent with impact score
  if (response.impactScore !== undefined) {
    if (response.impactScore >= 80) response.status = 'optimal';
    else if (response.impactScore >= 50) response.status = 'stable';
    else if (response.impactScore >= 25) response.status = 'risky';
    else response.status = 'damaging';
  }

  return response;
}
