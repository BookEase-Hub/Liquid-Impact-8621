// artifacts/api-server/src/services/providers/gemini-provider.ts
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { logger } from '../../lib/logger';
import { ProviderCallOptions, ProviderResponse } from './base';
import { env } from '../../lib/env';
import { zodSchemaToGeminiSchema } from '../../utils/zod-to-gemini';

const genAI = env.GOOGLE_AI_API_KEY ? new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY) : null;

export async function callGemini(options: ProviderCallOptions & { disableLogging?: boolean }): Promise<ProviderResponse> {
  const {
    imageBase64,
    systemPrompt,
    userPrompt,
    schema,
    timeoutMs,
    disableLogging = false,
    requestId,
  } = options;

  if (!genAI) {
    throw new Error('GOOGLE_AI_API_KEY is not set');
  }

  const geminiSchema = zodSchemaToGeminiSchema(schema);

  const model: GenerativeModel = genAI.getGenerativeModel({
    model: env.GOOGLE_AI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: geminiSchema as any,
      temperature: 0.05,
      maxOutputTokens: 1600,
    },
    // safetySettings: [], // Can be added if needed
  });

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    logger.debug({ model: env.GOOGLE_AI_MODEL, requestId }, 'Calling Gemini');

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: 'image/jpeg',
      },
    };

    const promptParts = [
      { text: systemPrompt },
      imagePart,
      { text: userPrompt },
    ];

    const result = await model.generateContent(promptParts, {
      signal: abortController.signal as any,
    });

    clearTimeout(timeoutId);

    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    const parsed = JSON.parse(text);

    // Gemini doesn't return confidence - infer from response quality
    const inferredConfidence = inferConfidenceFromResponse(parsed);

    return {
      raw: parsed,
      confidence: inferredConfidence,
      metadata: {
        model: env.GOOGLE_AI_MODEL,
        disableLogging,
      },
    };

  } catch (error: any) {
    clearTimeout(timeoutId);

    // Normalize Gemini errors
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      error.code = 'rate_limit_exceeded';
      error.status = 429;
    } else if (error.message?.includes('timeout') || error.name === 'AbortError') {
      error.code = 'timeout';
      error.status = 408;
    } else if (error.message?.includes('500') || error.message?.includes('internal')) {
      error.code = 'server_error';
      error.status = 500;
    }

    logger.error({ error: error.message, requestId }, 'Gemini call failed');
    throw error;
  }
}

function inferConfidenceFromResponse(response: any): number {
  // Heuristic confidence inference for Gemini (which doesn't report it)
  let confidence = 0.85; // Base confidence

  // Reduce confidence if uncertainty notes present
  if (response.uncertaintyNotes?.length > 0) {
    confidence -= 0.1 * response.uncertaintyNotes.length;
  }

  // Reduce if category is unknown
  if (response.category === 'unknown') {
    confidence -= 0.2;
  }

  // Reduce if confidenceScore field is low (if model provided one)
  if (typeof response.confidenceScore === 'number' && response.confidenceScore < 0.8) {
    confidence = Math.min(confidence, response.confidenceScore + 0.1);
  }

  return Math.max(0.3, Math.min(1.0, confidence));
}
