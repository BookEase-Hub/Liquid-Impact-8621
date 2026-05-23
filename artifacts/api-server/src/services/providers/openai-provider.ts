import OpenAI from 'openai';
import { logger } from '../../lib/logger';
import { ProviderCallOptions, ProviderResponse } from './base';
import { env } from '../../lib/env';

function getOpenAIClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey && !baseURL) {
    throw new Error('No OpenAI credentials. Set OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY.');
  }

  return new OpenAI({
    apiKey: apiKey || 'sk-placeholder',
    ...(baseURL ? { baseURL } : {}),
  });
}

export async function callOpenAI(options: ProviderCallOptions): Promise<ProviderResponse> {
  const { imageBase64, systemPrompt, userPrompt, timeoutMs, requestId } = options;

  const openai = getOpenAIClient();
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    logger.debug({ model: env.OPENAI_MODEL, requestId }, 'Calling OpenAI');

    const response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low',
              },
            },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
      temperature: 0.05,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
    }, {
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const parsed = JSON.parse(content);

    return {
      raw: parsed,
      confidence: parsed.confidenceScore,
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
      },
      metadata: {
        model: env.OPENAI_MODEL,
        finishReason: response.choices[0]?.finish_reason,
      },
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.status === 429) error.code = 'rate_limit_exceeded';
    else if (error.status === 408 || error.name === 'AbortError') error.code = 'timeout';
    else if (error.status >= 500) error.code = 'server_error';
    logger.error({ error: error.message, status: error.status, requestId }, 'OpenAI call failed');
    throw error;
  }
}
