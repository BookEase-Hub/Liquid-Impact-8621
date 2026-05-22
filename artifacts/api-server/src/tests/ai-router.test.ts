import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeWithIntelligentRouting } from '../services/ai-router';
import { analysisResponseSchema } from '../services/schema/analysis.schema';
import * as geminiProvider from '../services/providers/gemini-provider';
import * as openaiProvider from '../services/providers/openai-provider';

vi.mock('../services/providers/gemini-provider');
vi.mock('../services/providers/openai-provider');

const mockAnalysisResponse = {
  id: 'scan_12345678',
  detectedProduct: 'Test Water',
  brand: 'Test Brand',
  category: 'water',
  liquidType: 'beverage',
  confidenceScore: 0.9,
  isBeverage: true,
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
  impactScore: 100,
  status: 'optimal',
  hydrationLevel: 100,
  glycemicImpact: 'low',
  dehydrationRisk: false,
  shortTermImpact: {
    energyResponse: 'test',
    bloodSugarResponse: 'test',
    bodyReaction: 'test',
    hydrationImpact: 'test',
  },
  mediumTermImpact: {
    energyStability: 'test',
    physicalChanges: 'test',
    habitRisk: 'test',
    sleepQuality: 'test',
  },
  longTermImpact: {
    healthTrend: 'test',
    metabolicImpact: 'test',
    riskAccumulation: 'test',
    nutritionalBalance: 'test',
  },
  viralStatement: 'test',
  tiktokHook: 'test',
  aiInsight: 'test',
};

describe('AI Router - Failover Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses Gemini first when successful', async () => {
    vi.spyOn(geminiProvider, 'callGemini').mockResolvedValue({
      raw: mockAnalysisResponse,
      confidence: 0.9,
    });

    const result = await analyzeWithIntelligentRouting({
      imageBase64: 'fake',
      systemPrompt: 'test',
      userPrompt: 'test',
      schema: analysisResponseSchema,
    });

    expect(result.provider).toBe('gemini');
    expect(result.attemptNumber).toBe(1);
  });

  it('falls back to OpenAI when Gemini fails with rate limit', async () => {
    vi.spyOn(geminiProvider, 'callGemini').mockRejectedValue({ status: 429, code: 'rate_limit_exceeded', message: 'Rate limit' });
    vi.spyOn(openaiProvider, 'callOpenAI').mockResolvedValue({
      raw: { ...mockAnalysisResponse, id: 'scan_87654321' },
      confidence: 0.85,
    });

    const result = await analyzeWithIntelligentRouting({
      imageBase64: 'fake',
      systemPrompt: 'test',
      userPrompt: 'test',
      schema: analysisResponseSchema,
    });

    expect(result.provider).toBe('openai');
    expect(result.attemptNumber).toBe(2);
  });

  it('uses emergency fallback when all providers fail', async () => {
    vi.spyOn(geminiProvider, 'callGemini').mockRejectedValue({ status: 429, code: 'rate_limit_exceeded', message: 'Rate limit' });
    vi.spyOn(openaiProvider, 'callOpenAI').mockRejectedValue({ status: 500, code: 'server_error', message: 'Server error' });

    const result = await analyzeWithIntelligentRouting({
      imageBase64: 'fake',
      systemPrompt: 'test',
      userPrompt: 'test',
      schema: analysisResponseSchema,
    });

    expect(result.provider).toBe('fallback');
    expect(result.response.uncertaintyNotes).toContain('Fallback mode: AI providers unavailable');
  });

  it('validates output against Zod schema', async () => {
    vi.spyOn(geminiProvider, 'callGemini').mockResolvedValue({
      raw: { id: 'scan_bad' }, // Missing required fields
      confidence: 0.5,
    });

    await expect(analyzeWithIntelligentRouting({
      imageBase64: 'fake',
      systemPrompt: 'test',
      userPrompt: 'test',
      schema: analysisResponseSchema,
    })).rejects.toThrow(); // Zod validation error
  });
});
