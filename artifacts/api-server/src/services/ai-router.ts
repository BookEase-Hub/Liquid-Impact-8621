// artifacts/api-server/src/services/ai-router.ts
import { z } from 'zod';
import { logger } from '../lib/logger';
import { env } from '../lib/env';
import { getProviderOrder, PROVIDER_CONFIGS, RoutingContext, AIProvider, shouldEscalate } from '../config/providers.config';
import { AnalysisResponse, validateBeverageClassification } from './schema/analysis.schema';
import { callGemini } from './providers/gemini-provider';
import { callOpenAI } from './providers/openai-provider';
import { getFallbackResponse } from './providers/fallback-provider';
import { recordProviderMetrics, recordRoutingDecision } from './telemetry/provider-metrics';
import { normalizeProviderOutput } from './normalization/output-normalizer';
import { assessConfidence } from './intelligence/confidence-engine';
import { CircuitBreaker } from './safety/circuit-breaker';
import { checkSpendBudget } from './safety/spend-protector';

export interface AIRequest {
  imageBase64: string;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<AnalysisResponse>;
  context?: Partial<RoutingContext>;
  requestId?: string;
  userId?: string;
}

export interface AIResult {
  response: AnalysisResponse;
  provider: AIProvider;
  attemptNumber: number;
  latencyMs: number;
  escalated: boolean;
}

// Circuit breakers per provider
const circuitBreakers: Record<AIProvider, CircuitBreaker> = {
  gemini: new CircuitBreaker({ failureThreshold: 5, resetTimeout: 30000 }),
  openai: new CircuitBreaker({ failureThreshold: 3, resetTimeout: 60000 }),
  fallback: new CircuitBreaker({ failureThreshold: 1, resetTimeout: 5000 }),
};

/**
 * Main entry point: Analyze with intelligent provider routing
 */
export async function analyzeWithIntelligentRouting(req: AIRequest): Promise<AIResult> {
  const startTime = Date.now();
  const requestId = req.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 1. Check spend budget first
  const budgetCheck = await checkSpendBudget(req.userId);
  if (!budgetCheck.allowed && !req.context?.urgency) {
    logger.warn({ requestId, reason: budgetCheck.reason }, 'Spend budget exceeded');
    return await executeProvider('fallback', req, requestId, 1);
  }

  // 2. Build routing context
  const routingContext: RoutingContext = {
    scanType: 'complex_label',
    imageComplexity: 'medium',
    ocrConfidence: 0.8,
    userTier: 'free',
    urgency: 'normal',
    budgetRemaining: budgetCheck.remaining,
    providerHealth: await getProviderHealthSnapshot(),
    ...req.context,
  };

  // 3. Get provider order based on strategy
  const providerOrder = getProviderOrder(env.AI_ROUTER_STRATEGY as any);

  let lastError: Error | null = null;
  let escalated = false;

  for (let attempt = 0; attempt < providerOrder.length; attempt++) {
    const providerId = providerOrder[attempt];
    const config = PROVIDER_CONFIGS[providerId];
    const breaker = circuitBreakers[providerId];

    if (!breaker.allowRequest()) {
      logger.debug({ providerId, requestId }, 'Circuit breaker open, skipping');
      continue;
    }

    if (config.skipIf(routingContext)) {
      logger.debug({ providerId, requestId }, 'Skipping provider per routing rules');
      continue;
    }

    try {
      logger.info({
        provider: providerId,
        attempt: attempt + 1,
        requestId,
        scanType: routingContext.scanType,
      }, 'Attempting AI analysis');

      const result = await executeProvider(
        providerId,
        req,
        requestId,
        attempt + 1
      );

      const confidence = assessConfidence(result.response, routingContext);

      const providerResult: any = {
        confidence,
        parseSuccess: true,
        latencyMs: result.latencyMs,
        cost: config.costPerScan,
      };

      if (shouldEscalate(providerId, routingContext, providerResult)) {
        logger.info({
          providerId,
          confidence,
          reason: 'low_confidence_or_ambiguous',
          requestId,
        }, 'Escalating to higher-tier provider');
        escalated = true;
        continue;
      }

      const beverageCheck = validateBeverageClassification(result.response);
      if (!beverageCheck.valid) {
        logger.warn({
          providerId,
          warning: beverageCheck.warning,
          category: result.response.category,
          requestId,
        }, 'Beverage classification validation failed');
        result.response.uncertaintyNotes = [
          ...(result.response.uncertaintyNotes || []),
          beverageCheck.warning!,
        ];
      }

      if (env.TELEMETRY_ENABLED) {
        await recordProviderMetrics({
          provider: providerId,
          success: true,
          latencyMs: result.latencyMs,
          cost: config.costPerScan,
          requestId,
          metadata: {
            scanType: routingContext.scanType,
            confidence,
            escalated,
            attemptNumber: attempt + 1,
          },
        });

        await recordRoutingDecision({
          requestId,
          selectedProvider: providerId,
          attemptNumber: attempt + 1,
          reason: 'success',
          context: routingContext,
          confidence,
          escalated,
        });
      }

      breaker.recordSuccess();

      return {
        ...result,
        escalated,
      };

    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      breaker.recordFailure();

      logger.warn({
        provider: providerId,
        attempt: attempt + 1,
        error: error.message || error,
        requestId,
      }, 'Provider failed');

      if (env.TELEMETRY_ENABLED) {
        await recordProviderMetrics({
          provider: providerId,
          success: false,
          latencyMs,
          cost: 0,
          requestId,
          error: {
            code: error.code || error.status,
            message: error.message,
          },
        });
      }

      lastError = error;

      const isTransient = config.retryOn.some(condition => {
        if (condition === 'rate_limit' && (error.code === 'rate_limit_exceeded' || error.status === 429)) return true;
        if (condition === 'timeout' && (error.code === 'timeout' || error.status === 408)) return true;
        if (condition === 'server_error' && (error.status >= 500 || error.code === 'server_error')) return true;
        if (condition === 'bad_response' && error.code === 'parse_error') return true;
        return false;
      });

      if (!isTransient) {
        logger.error({
          provider: providerId,
          error: error.message,
          reason: 'non_retryable_error',
          requestId,
        }, 'Non-retryable error, aborting');
        throw error;
      }

      continue;
    }
  }

  logger.error({
    allProvidersFailed: true,
    lastError: lastError?.message,
    requestId,
  }, 'All AI providers failed, using emergency fallback');

  const fallbackResult = await executeProvider('fallback', req, requestId, providerOrder.length + 1);

  if (env.TELEMETRY_ENABLED) {
    await recordRoutingDecision({
      requestId,
      selectedProvider: 'fallback',
      attemptNumber: providerOrder.length + 1,
      reason: 'emergency_fallback',
      context: routingContext,
      error: lastError?.message,
    });
  }

  return {
    ...fallbackResult,
    escalated: false,
  };
}

async function executeProvider(
  providerId: AIProvider,
  req: AIRequest,
  requestId: string,
  attemptNumber: number
): Promise<Omit<AIResult, 'escalated'>> {
  const config = PROVIDER_CONFIGS[providerId];
  const start = Date.now();

  let rawResult: any;

  switch (providerId) {
    case 'gemini':
      rawResult = await callGemini({
        imageBase64: req.imageBase64,
        systemPrompt: req.systemPrompt,
        userPrompt: req.userPrompt,
        schema: req.schema,
        timeoutMs: config.timeoutMs,
        disableLogging: env.GOOGLE_AI_DISABLE_LOGGING as any,
        requestId,
      });
      break;

    case 'openai':
      rawResult = await callOpenAI({
        imageBase64: req.imageBase64,
        systemPrompt: req.systemPrompt,
        userPrompt: req.userPrompt,
        schema: req.schema,
        timeoutMs: config.timeoutMs,
        requestId,
      });
      break;

    case 'fallback':
      rawResult = { raw: await getFallbackResponse(req) };
      break;

    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }

  const normalized = normalizeProviderOutput(rawResult.raw, providerId);
  const parsed = req.schema.parse(normalized);
  const latencyMs = Date.now() - start;

  return {
    response: parsed,
    provider: providerId,
    attemptNumber,
    latencyMs,
  };
}

async function getProviderHealthSnapshot(): Promise<Record<AIProvider, any>> {
  return {
    gemini: { uptime: 0.999, avgLatency: 1200, errorRate: 0.01 },
    openai: { uptime: 0.995, avgLatency: 2000, errorRate: 0.02 },
    fallback: { uptime: 1.0, avgLatency: 10, errorRate: 0 },
  };
}
