// artifacts/api-server/src/services/telemetry/provider-metrics.ts
import { logger } from '../../lib/logger';
import { AIProvider } from '../../config/providers.config';
// import { db, scansTable } from '@workspace/db';

export interface ProviderMetric {
  provider: AIProvider;
  success: boolean;
  latencyMs: number;
  cost: number;
  requestId: string;
  userId?: string;
  timestamp?: number;
  error?: { code?: string; message?: string };
  metadata?: {
    scanType?: string;
    confidence?: number;
    escalated?: boolean;
    attemptNumber?: number;
    imageComplexity?: string;
  };
}

export interface RoutingDecision {
  requestId: string;
  selectedProvider: AIProvider | null;
  attemptNumber: number;
  reason: 'success' | 'all_failed' | 'emergency_fallback' | 'skipped' | 'escalated';
  context: any;
  confidence?: number;
  escalated?: boolean;
  error?: string;
  timestamp?: number;
}

export async function recordProviderMetrics(metric: ProviderMetric): Promise<void> {
  const entry = {
    ...metric,
    timestamp: metric.timestamp || Date.now(),
  };

  logger.info({ metric: 'provider_call', ...entry }, 'Provider metric recorded');

  // Persistence to DB would go here.
  // Given we don't want to modify the DB schema now, we just log it.
}

export async function recordRoutingDecision(decision: RoutingDecision): Promise<void> {
  const entry = {
    ...decision,
    timestamp: decision.timestamp || Date.now(),
  };

  logger.info({ metric: 'routing_decision', ...entry }, 'Routing decision recorded');
}

export async function getDailySpend(userId?: string): Promise<{ total: number; byProvider: Record<AIProvider, number> }> {
  // Placeholder until DB persistence is implemented
  return { total: 0, byProvider: { gemini: 0, openai: 0, fallback: 0 } };
}
