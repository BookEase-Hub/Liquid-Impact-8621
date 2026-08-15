---
name: Scan ID uniqueness fix
description: How the recent-scan-shows-wrong-item bug was fixed and the rules to maintain.
---

## The bug
When a user scanned two different items, tapping the first item in history opened the second item. Root cause: multiple scans shared the same `id` field (set by the AI response template or cached results), so `state.scans.find(s => s.id === id)` returned the wrong record.

## The fix
**Rule: every independent scan session always gets a guaranteed-fresh ID, generated client-side.**

1. `services/api.ts` — `analyzeDrink()` always overwrites the server ID:
   ```ts
   return { ...data, id: genScanId(), scannedAt: Date.now() } as ScanResult;
   ```

2. `app/(tabs)/scan.tsx` — MMKV cache hits, local DB hits, and fuzzy match hits ALL get fresh IDs:
   ```ts
   const freshResult = { ...cached, id: genScanId(), scannedAt: Date.now(), imageUri: input.imageUri };
   ```

3. `genScanId()` helper: `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

**Why:** The server may return cached product data with a previous scan's ID. The client must never trust the server ID for scan history — only use it as product data payload.

**How to apply:** Any future code path that calls `addScan()` must ensure the scan object has a freshly-generated ID, not one from a cache or previous session.
