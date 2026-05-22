// artifacts/api-server/src/lib/env.ts
import { z } from 'zod';

export const envSchema = z.object({
  // === AI Providers ===
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_TIMEOUT_MS: z.coerce.number().min(1000).max(120000).default(40000),
  OPENAI_MAX_RETRIES: z.coerce.number().min(0).max(5).default(1),

  GOOGLE_AI_API_KEY: z.string().min(1).optional(),
  GOOGLE_AI_MODEL: z.string().default('gemini-2.0-flash'),
  GOOGLE_AI_TIMEOUT_MS: z.coerce.number().min(1000).max(120000).default(30000),
  GOOGLE_AI_DISABLE_LOGGING: z.string().transform(v => v === 'true').default('false'),

  // === Router Strategy ===
  AI_ROUTER_STRATEGY: z.enum(['failover', 'cost-optimized', 'quality-first']).default('failover'),
  AI_ROUTER_RETRY_ON: z.array(z.enum(['rate_limit', 'timeout', 'server_error'])).default(['rate_limit', 'timeout']),
  CONFIDENCE_ESCALATION_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),

  // === Cost Protection ===
  DAILY_BUDGET_LIMIT_USD: z.coerce.number().min(0).default(50),
  MONTHLY_BUDGET_LIMIT_USD: z.coerce.number().min(0).default(1000),
  COST_ALERT_THRESHOLD_PERCENT: z.coerce.number().min(0).max(100).default(80),
  EMERGENCY_SPEND_SHUTDOWN: z.string().transform(v => v === 'true').default('false'),

  // === Quotas ===
  FREE_TIER_DAILY_SCANS: z.coerce.number().min(0).default(3),
  STARTER_TIER_DAILY_SCANS: z.coerce.number().min(0).default(50),
  PRO_TIER_DAILY_SCANS: z.coerce.number().min(0).default(999999), // "unlimited"
  RATE_LIMIT_SCANS_PER_MINUTE: z.coerce.number().min(1).default(5),

  // === Telemetry ===
  TELEMETRY_ENABLED: z.string().transform(v => v === 'true').default('true'),
  TELEMETRY_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  METRICS_ENDPOINT: z.string().url().optional(),

  // === Redis ===
  REDIS_URL: z.string().url().optional(),
  REDIS_KEY_PREFIX: z.string().default('liquidimpact:'),

  // === App ===
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  FRONTEND_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).default('a-very-long-and-secure-default-secret-for-development'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

export function requireEnv<K extends keyof Env>(key: K, message?: string): NonNullable<Env[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(message || `Required environment variable ${key} is not set`);
  }
  return value as NonNullable<Env[K]>;
}

export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}
