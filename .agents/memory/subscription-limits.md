---
name: Subscription limits
description: How scan limits are structured and enforced across free and paid tiers.
---

**Rule:** `SUBSCRIPTION_LIMITS` in `AppContext.tsx` uses `total` (not `daily`) for the free tier key.

**Why:** Free tier is 3 scans LIFETIME — not per day and not per month. The field was renamed from `daily` to `total` to reflect this. Any code referencing `limits.daily` will break with a TypeScript error.

**Tier structure:**
- free: `{ total: 3, monthly: null }` — 3 lifetime scans, no reset ever
- starter: `{ total: null, monthly: 100 }` — 100/month
- pro: `{ total: null, monthly: null }` — unlimited
- elite: `{ total: null, monthly: null }` — unlimited  
- family: `{ total: null, monthly: null }` — unlimited

**canScan logic:**
```
free → state.scans.length < 3
paid monthly → monthScanCount < limits.monthly
pro/elite/family → always true
```

**Files:** `artifacts/liquid-impact/context/AppContext.tsx` — `SUBSCRIPTION_LIMITS`, `canScan`, `scanLimitMessage`.
