---
name: Scan JSON fix
description: How to avoid the OpenAI 400 "messages must contain json" error in the scan route.
---

**Rule:** Never use `response_format: { type: "json_object" }` with OpenAI vision calls.

**Why:** OpenAI's json_object mode requires the literal word "json" to appear in the system or user messages as constructed by the library. When using `analyzeWithIntelligentRouting` we had no control over how it built messages internally, so the requirement was silently violated.

**How to apply:** Call `openai.chat.completions.create()` directly with NO `response_format` parameter. Embed a complete JSON template in the user prompt. Extract JSON from the raw text response using regex (`content.match(/\{[\s\S]*\}/)`). Apply manual defaults for every field so partial responses never crash.

**Files:** `artifacts/api-server/src/routes/scans.ts` — `callAIVision()` function + `extractAndNormalize()` function.
