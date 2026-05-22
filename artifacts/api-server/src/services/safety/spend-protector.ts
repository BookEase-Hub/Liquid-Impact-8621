// artifacts/api-server/src/services/safety/spend-protector.ts
import { env } from '../../lib/env';
import { logger } from '../../lib/logger';
// import { getDailySpend } from '../telemetry/provider-metrics';

export interface SpendCheckResult {
  allowed: boolean;
  remaining: number;
  reason?: string;
}

export async function checkSpendBudget(userId?: string): Promise<SpendCheckResult> {
  // Mocking getDailySpend for now as it depends on DB which we haven't fully adapted yet
  const dailySpend = 0;

  const budgetLimit = env.DAILY_BUDGET_LIMIT_USD;
  const remaining = budgetLimit - dailySpend;

  if (remaining < 0) {
    if (env.EMERGENCY_SPEND_SHUTDOWN === 'true') {
      logger.error({ dailySpend, budgetLimit, userId }, 'Emergency spend shutdown triggered');
      return { allowed: false, remaining: 0, reason: 'emergency_shutdown' };
    }

    const threshold = budgetLimit * (env.COST_ALERT_THRESHOLD_PERCENT / 100);
    if (dailySpend > threshold) {
      logger.warn({ dailySpend, threshold, budgetLimit, userId }, 'Spend alert threshold exceeded');
    }

    return { allowed: false, remaining: 0, reason: 'budget_exceeded' };
  }

  return { allowed: true, remaining };
}

export async function checkUserQuota(userId: string, userTier: 'free' | 'starter' | 'pro' | 'elite' | 'family'): Promise<{ allowed: boolean; remaining: number }> {
  const limits = {
    free: env.FREE_TIER_DAILY_SCANS,
    starter: env.STARTER_TIER_DAILY_SCANS,
    pro: env.PRO_TIER_DAILY_SCANS,
    elite: 999999,
    family: 999999,
  };

  const limit = limits[userTier] || env.FREE_TIER_DAILY_SCANS;
  if (limit >= 999999) return { allowed: true, remaining: 999999 };

  // For real quota check, we'd query the DB
  return { allowed: true, remaining: limit };
}
