---
name: Food Pivot — Impact (was Liquid Impact)
description: Key decisions made when pivoting from drinks-only to all-food scanner
---

## Rebrand
- Display name: "Liquid Impact" → "Impact" everywhere in UI
- `app.json` slug stays `liquid-impact` (changing breaks proxy routing)
- AsyncStorage key stays `@liquid_impact_v2` (changing it would wipe user data)
- Bundle IDs: `com.impact.app` (updated in app.json)

## Pivot — consumableType field
The primary discriminator between food and drink scans is `consumableType`:
- `beverage` | `solid_food` | `mixed_meal` | `snack` | `condiment` | `supplement`
- AI is instructed to classify this FIRST in the system prompt
- `liquidType` kept for backward compat but `consumableType` is the new source of truth

## New food-specific fields (all optional/nullable for backward compat)
- `satietyScore` (0-100), `digestiveLoad` (light/moderate/heavy), `nutrientDensity` (0-100)
- `fiberEstimate` (low/medium/high), `proteinQuality` (complete/incomplete/not_applicable)
- `mealTimingFit` (JSON: breakfast/lunch/dinner/snack each rated excellent/good/fair/poor)
- `bloodSugarTrajectory` (spike/sustained/gradual/crash)
- `componentBreakdown` (JSON array: component, percentage, impactScore — for mixed meals)
- `allergenFlags` (string array)
- `processingLevel` (whole/minimally_processed/processed/ultra_processed)

## DB migration
- Added all food columns to `scansTable` as nullable
- Added `totalFoodScans` / `totalDrinkScans` to `userProfilesTable`
- Added `consumableType` to `productsTable`
- Migration: `pnpm --filter @workspace/db run push`

## AI prompt strategy
- System prompt: classify consumableType FIRST, then branch analysis per type
- Gemini responseSchema already enforces output shape — prompt only gives GUIDANCE, not template
- Impact scale for food: leafy greens/whole=85+ | lean protein=78 | complex carbs=70 | processed snack=40 | fast food=30 | ultra-processed=20

**Why:** Short prompts + schema enforcement = faster response (3-5s target)
**How to apply:** When adding new food subcategories, update SYSTEM_PROMPT classification step AND analysis.schema.ts

## Missions (new food missions added)
- `mission_protein`: Scan a meal with 20g+ protein
- `mission_whole`: Scan a whole or minimally processed food
- `mission_fiber`: Scan a high-fiber food
