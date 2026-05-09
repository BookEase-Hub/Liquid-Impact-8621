# Liquid Impact

A cross-platform mobile app that scans drinks via camera, uses GPT-4o vision AI to analyze health impact, and returns scores, ingredient analysis, short/medium/long-term effects, hydration data, and glycemic impact.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/liquid-impact run dev` — run the Expo app (port 26050)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `DATABASE_URL` — Postgres connection string; `REPLIT_AI_MODELS_URL` — set automatically via Replit OpenAI integration

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + `@workspace/integrations-openai-ai-server` (GPT-4o vision)
- Mobile: Expo SDK 54 + React Native + Expo Router v6
- DB: PostgreSQL + Drizzle ORM (for future server-side features)
- Build: esbuild (API), Metro (Expo)

## Where things live

- `artifacts/api-server/src/routes/scans.ts` — GPT-4o vision analysis route (`POST /api/scans/analyze`)
- `artifacts/liquid-impact/app/(tabs)/` — 5 tabs: Home, Status, Scan, History, Profile
- `artifacts/liquid-impact/app/report.tsx` — Full scan report (modal)
- `artifacts/liquid-impact/app/onboarding.tsx` — 4-slide onboarding
- `artifacts/liquid-impact/context/AppContext.tsx` — Global state (scans, streak, missions)
- `artifacts/liquid-impact/services/api.ts` — API client (fetch wrapper)
- `artifacts/liquid-impact/components/ui.tsx` — Shared UI: ScoreRing, GlassCard, DrinkCard, etc.
- `artifacts/liquid-impact/constants/colors.ts` — Dark theme design tokens
- `lib/api-spec/openapi.yaml` — Source-of-truth API spec

## Architecture decisions

- Scans are stored in AsyncStorage on-device only — no server-side scan persistence needed for MVP
- GPT-4o vision model used for image analysis; results are parsed from JSON in the LLM response
- Dark-first theme: both `light` and `dark` keys in colors.ts use the same dark palette
- Free plan: 5 scans/day enforced client-side; subscription tier stored in AsyncStorage
- API body limit set to 50mb to support base64-encoded images

## Product

- **Scan**: Camera or gallery → GPT-4o analyzes drink → impact score (0–100), status (optimal/stable/risky/damaging), hydration, glycemic impact
- **Report**: Full AI report with short-term (1-2 hrs), medium-term (weeks), long-term (months/years) body effects + ingredient breakdown
- **Status**: Body metrics dashboard derived from scan history (hydration, energy, recovery, focus)
- **History**: Scan feed with weekly bar chart, filter by status
- **Profile**: Stats, daily missions, subscription management
- **Onboarding**: 4-slide intro before first use

## Gotchas

- Do NOT use `zod/v4` in api-server routes — esbuild can't resolve it; use `zod` directly or skip validation
- `EXPO_PUBLIC_DOMAIN` must be set to `$REPLIT_DEV_DOMAIN` in the Expo workflow env for API calls to work
- The integrations-openai-ai-server lib has typecheck warnings (p-retry types, @types/node) that don't affect runtime
- Codegen (orval) succeeds even if typecheck:libs warns — the generated files in lib/api-client-react and lib/api-zod are correct

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
