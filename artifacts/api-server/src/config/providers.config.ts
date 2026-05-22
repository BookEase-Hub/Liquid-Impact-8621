// artifacts/api-server/src/config/providers.config.ts
import { env } from '../lib/env';

export type AIProvider = 'gemini' | 'openai' | 'fallback';

export interface ProviderCapabilities {
  vision: boolean;
  jsonSchema: boolean;
  streaming: boolean;
  maxImageSizeMB: number;
  supportsConfidence: boolean;
  avgLatencyMs: number;
}

export interface ProviderConfig {
  id: AIProvider;
  priority: number; // Lower = higher priority (1 = first attempt)
  timeoutMs: number;
  maxRetries: number;
  costPerScan: number; // USD estimate for budgeting
  capabilities: ProviderCapabilities;
  retryOn: Array<'rate_limit' | 'timeout' | 'server_error' | 'bad_response'>;
  skipIf: (ctx: RoutingContext) => boolean; // Dynamic skip logic
  escalateIf: (ctx: RoutingContext, result: ProviderResult) => boolean; // When to escalate
}

export interface RoutingContext {
  scanType: 'simple_barcode' | 'complex_label' | 'no_label' | 'ambiguous' | 'cooking_liquid';
  imageComplexity: 'low' | 'medium' | 'high';
  ocrConfidence: number; // 0-1
  userTier: 'free' | 'starter' | 'pro' | 'elite' | 'family';
  urgency: 'normal' | 'high';
  budgetRemaining: number; // Daily budget remaining in USD
  providerHealth: Record<AIProvider, ProviderHealth>;
}

export interface ProviderHealth {
  uptime: number; // 0-1
  avgLatency: number;
  errorRate: number; // 0-1
  lastError?: string;
}

export interface ProviderResult {
  confidence: number; // 0-1, model-reported or inferred
  parseSuccess: boolean;
  latencyMs: number;
  cost: number;
}

export const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  gemini: {
    id: 'gemini',
    priority: 1, // First choice: cheapest acceptable
    timeoutMs: env.GOOGLE_AI_TIMEOUT_MS,
    maxRetries: 2,
    costPerScan: 0.0005, // ~30x cheaper than GPT-4o
    capabilities: {
      vision: true,
      jsonSchema: true,
      streaming: true,
      maxImageSizeMB: 20,
      supportsConfidence: false, // Gemini doesn't return confidence natively
      avgLatencyMs: 1200,
    },
    retryOn: ['rate_limit', 'timeout', 'server_error', 'bad_response'],
    skipIf: (ctx) => {
      // Skip for high-complexity scans in quality-first mode
      if (env.AI_ROUTER_STRATEGY === 'quality-first' && ctx.imageComplexity === 'high') {
        return true;
      }
      // Skip if budget is exhausted and this isn't emergency fallback
      if (ctx.budgetRemaining < 0.01 && ctx.urgency !== 'high') {
        return true;
      }
      return false;
    },
    escalateIf: (ctx, result) => {
      // Escalate if confidence is low (inferred from response quality)
      if (result.confidence < env.CONFIDENCE_ESCALATION_THRESHOLD) {
        return true;
      }
      // Escalate for ambiguous beverage classification
      if (ctx.scanType === 'ambiguous' && !result.parseSuccess) {
        return true;
      }
      return false;
    },
  },

  openai: {
    id: 'openai',
    priority: 2, // Premium fallback (now gpt-4o-mini)
    timeoutMs: env.OPENAI_TIMEOUT_MS,
    maxRetries: 1,
    costPerScan: 0.0006, // GPT-4o-mini vision estimate is much cheaper than gpt-4o
    capabilities: {
      vision: true,
      jsonSchema: true,
      streaming: false,
      maxImageSizeMB: 20,
      supportsConfidence: true,
      avgLatencyMs: 2000,
    },
    retryOn: ['rate_limit', 'timeout', 'server_error'],
    skipIf: (ctx) => {
      // Skip if budget exhausted
      if (ctx.budgetRemaining < 0.001) {
        return true;
      }
      return false;
    },
    escalateIf: () => false, // GPT-4o-mini is currently our top tier in this config
  },

  fallback: {
    id: 'fallback',
    priority: 999, // Last resort only
    timeoutMs: 5000,
    maxRetries: 0,
    costPerScan: 0,
    capabilities: {
      vision: false,
      jsonSchema: false,
      streaming: false,
      maxImageSizeMB: 0,
      supportsConfidence: false,
      avgLatencyMs: 10,
    },
    retryOn: [],
    skipIf: () => false, // Always available as emergency fallback
    escalateIf: () => false,
  },
};

export function getProviderOrder(strategy: 'failover' | 'cost-optimized' | 'quality-first' = 'failover'): AIProvider[] {
  const configs = Object.values(PROVIDER_CONFIGS);

  if (strategy === 'cost-optimized') {
    return configs.sort((a, b) => a.costPerScan - b.costPerScan).map(c => c.id);
  }

  if (strategy === 'quality-first') {
    return configs.sort((a, b) => b.priority - a.priority).map(c => c.id);
  }

  // Default failover: by priority (lower = first)
  return configs.sort((a, b) => a.priority - b.priority).map(c => c.id);
}

export function shouldEscalate(
  provider: AIProvider,
  ctx: RoutingContext,
  result: ProviderResult
): boolean {
  const config = PROVIDER_CONFIGS[provider];
  return config.escalateIf(ctx, result);
}
