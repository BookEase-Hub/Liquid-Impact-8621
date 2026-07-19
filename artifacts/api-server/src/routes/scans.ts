import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, scansTable } from "@workspace/db";
import { verifyAccessToken } from "../middleware/authMiddleware";
import { logger } from "../lib/logger";
import { lookupBeverageByKeywords } from "../services/beverage-cache";
import {
  computeImageHash,
  buildFingerprint,
  getCachedByImageHash,
  getCachedByBarcode,
  getCachedByFingerprint,
  dbLookupByImageHash,
  dbLookupByBarcode,
  dbLookupByFingerprint,
  saveProduct,
} from "../services/product-intelligence";
import { lookupByBarcode as offLookupByBarcode, searchByName as offSearchByName } from "../services/open-food-facts";

const router = Router();

// ─── Phase 1: Fast identification prompt (gpt-4o-mini, detail:low) ─────────────
// Target: 2-3 seconds. No impact text fields — those come from Phase 2 (enhance).
const FAST_SYSTEM_PROMPT = `You are a fast food and drink analyzer. Return ONLY valid JSON — no markdown, no preamble.

RULES:
• Identify every item using visual evidence (logo, label, colour, texture, cooking style, container). Never return "Unknown Item" — use "Possible [X]" or most specific category.
• CONDIMENT: consumableType="condiment" ONLY for ketchup/hot sauce/soy sauce/mustard/mayo/vinegar/relish. NEVER for rice, ugali, chapati, stew, curry, soup, vegetables, meat, fish, fruit, or any meal.
• Nutrition: calories ≈ protein×4 + carbs×4 + fat×9 (±10%). Never output 0 for real food — only plain water = 0 kcal. Scale to the serving size VISIBLE in the image, not per 100g.
• Scoring: impactScore 0–100 (higher=healthier). Status: optimal(80+) stable(50–79) risky(25–49) damaging(0–24).
• Quick reference: Coca-Cola 330ml=139kcal/35g carbs; banana=107kcal/27g carbs; ugali 200g=260kcal/58g carbs; chicken breast 150g=248kcal/47g protein; full meal plate=400–900kcal.`;

const FAST_USER_PROMPT = `Identify the food or drink in this image. Return ONLY this JSON object:

{
  "detectedProduct": "<specific name — 'Coca-Cola Classic 330ml', 'Ugali with Nyama Choma and Sukuma Wiki', 'Big Mac', 'Grilled Salmon with Vegetables', 'Banana' — NEVER 'Unknown Item'>",
  "brand": "<brand name or null>",
  "category": "<water|soda|energy_drink|tea|coffee|juice|alcohol|sports_drink|dairy|plant_milk|supplement|solid_food|mixed_meal|snack|condiment|other>",
  "liquidType": "<beverage|cooking_oil|condiment|alcohol|supplement|other>",
  "consumableType": "<beverage|solid_food|mixed_meal|snack|condiment|supplement>",
  "confidenceScore": 0.9,
  "impactScore": 65,
  "hydrationLevel": 55,
  "glycemicImpact": "<low|moderate|high|very_high>",
  "status": "<optimal|stable|risky|damaging>",
  "dehydrationRisk": false,
  "satietyScore": 65,
  "digestiveLoad": "<light|moderate|heavy>",
  "nutrientDensity": 55,
  "fiberEstimate": "<low|medium|high>",
  "proteinQuality": "<complete|incomplete|not_applicable>",
  "processingLevel": "<whole|minimally_processed|processed|ultra_processed>",
  "mealType": "<breakfast|lunch|dinner|snack>",
  "mealTimingFit": {"breakfast":"fair","lunch":"good","dinner":"good","snack":"poor"},
  "bloodSugarTrajectory": "<spike|sustained|gradual|crash>",
  "allergenFlags": [],
  "componentBreakdown": [],
  "aiInsight": "<2-3 sentences naming this specific item. Describe its nutritional profile and key health note. Be specific — no generic text.>",
  "viralStatement": "<8-12 word punchy health fact specific to this exact item>",
  "alternatives": ["<healthier specific alternative>", "<another healthier alternative>"],
  "composition": {
    "calories": 150,
    "carbsGrams": 35,
    "sugarGrams": 33,
    "caffeineMg": 0,
    "sodiumMg": 45,
    "fatGrams": 0,
    "proteinGrams": 0,
    "fiberGrams": 0,
    "servingSize": 330,
    "servingUnit": "ml",
    "artificialSweeteners": false,
    "additives": [],
    "ingredients": [
      {"name":"<ingredient>","function":"<body role>","healthRole":"<positive|neutral|concerning>","riskLevel":"<low|medium|high>","description":"<1 sentence>","aiNote":"<actionable insight>"}
    ]
  }
}`;

// ─── Phase 2: Impact enhancement prompt (text-only, no image) ──────────────────
const ENHANCE_SYSTEM_PROMPT = `You are a clinical nutritionist writing detailed health impact analyses for a health app.
Given a food or drink product and its nutrition facts, write specific scientific impact analyses.
Always reference the actual product name and ingredients. Never write generic placeholder text.
Return ONLY valid JSON — no markdown, no preamble.`;

function buildEnhanceUserPrompt(
  detectedProduct: string,
  category: string,
  consumableType: string,
  composition: Record<string, unknown>,
): string {
  const cal = composition.calories ?? "unknown";
  const protein = composition.proteinGrams ?? 0;
  const carbs = composition.carbsGrams ?? composition.sugarGrams ?? 0;
  const fat = composition.fatGrams ?? 0;
  const sugar = composition.sugarGrams ?? 0;
  const caffeine = composition.caffeineMg ?? 0;
  const sodium = composition.sodiumMg ?? 0;
  const fiber = composition.fiberGrams ?? 0;

  return `Product: ${detectedProduct}
Type: ${consumableType} | Category: ${category}
Nutrition per serving: ${cal} kcal | Protein: ${protein}g | Carbs: ${carbs}g | Fat: ${fat}g | Sugar: ${sugar}g | Caffeine: ${caffeine}mg | Sodium: ${sodium}mg | Fiber: ${fiber}g

Write a detailed health impact analysis specific to ${detectedProduct}. Return this JSON:
{
  "shortTermImpact": {
    "energyResponse": "<2-3 sentences on blood glucose and energy curve in first 1-4 hours. Name the actual carb/sugar sources. Describe insulin response and crash risk.>",
    "bloodSugarResponse": "<2-3 sentences on glycaemic trajectory. Estimate GI of main carb source. Describe spike risk and absorption speed.>",
    "bodyReaction": "<2-3 sentences on immediate physiological effects — digestion, satiety, bloating, inflammation from specific ingredients.>",
    "hydrationImpact": "<2-3 sentences on net hydration effect, electrolytes provided or depleted, fluid balance.>"
  },
  "mediumTermImpact": {
    "energyStability": "<2-3 sentences on 7-30 day energy patterns from regular consumption.>",
    "physicalChanges": "<2-3 sentences on body composition changes — weight, muscle, water retention.>",
    "habitRisk": "<2-3 sentences on addiction/dependency potential from caffeine, sugar, or other compounds.>",
    "sleepQuality": "<2-3 sentences on sleep effects — caffeine half-life, glycaemic nocturnal swings, optimal cutoff time.>"
  },
  "longTermImpact": {
    "healthTrend": "<2-3 sentences on 1-5 year health trajectory. Reference epidemiological evidence for this food category.>",
    "metabolicImpact": "<2-3 sentences on insulin sensitivity, hepatic fat risk, LDL/HDL/triglyceride effects.>",
    "riskAccumulation": "<2-3 sentences on chronic disease risk — cardiovascular, diabetes, cancer associations.>",
    "nutritionalBalance": "<2-3 sentences on micronutrient density, vitamins/minerals provided, gut microbiome effects.>"
  }
}`;
}

// ─── Robust JSON extraction + defaults ────────────────────────────────────────
function extractAndNormalize(raw: string): Record<string, unknown> {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // Try to find a JSON object — scan from the first { to match all nested braces
  let data: Record<string, unknown> | null = null;
  const start = cleaned.indexOf("{");
  if (start !== -1) {
    // Walk backwards from end to find matching closing brace
    let depth = 0;
    let end = -1;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === "{") depth++;
      else if (cleaned[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) {
      const candidate = cleaned.slice(start, end + 1);
      try {
        data = JSON.parse(candidate);
      } catch {
        // Repair trailing commas and control characters then retry
        const repaired = candidate
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/[\u0000-\u001F\u007F]/g, " ");
        try { data = JSON.parse(repaired); } catch { /* fall through to fallback */ }
      }
    }
  }

  // If we still have nothing, build a fallback so the user always sees a result
  if (!data) {
    logger.warn({ rawLen: raw.length, rawSnippet: raw.slice(0, 200) }, "AI returned no parseable JSON — using fallback");
    data = {};
  }

  // ── ID ──────────────────────────────────────────────────────────────────────
  if (!data.id || typeof data.id !== "string" || !/^scan_/.test(data.id)) {
    data.id = `scan_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  // ── Core scalars ────────────────────────────────────────────────────────────
  if (!data.detectedProduct) data.detectedProduct = "Unknown Item";
  if (data.brand === undefined) data.brand = null;
  if (!data.category) data.category = "other";
  if (!data.liquidType) data.liquidType = "beverage";
  if (!data.consumableType) data.consumableType = "beverage";
  if (typeof data.confidenceScore !== "number") data.confidenceScore = 0.7;
  if (typeof data.impactScore !== "number") data.impactScore = 50;
  if (typeof data.hydrationLevel !== "number") data.hydrationLevel = 50;
  if (!data.glycemicImpact) data.glycemicImpact = "moderate";
  if (!data.status) {
    const s = data.impactScore as number;
    data.status = s >= 80 ? "optimal" : s >= 50 ? "stable" : s >= 25 ? "risky" : "damaging";
  }
  if (typeof data.dehydrationRisk !== "boolean") data.dehydrationRisk = false;
  if (!data.aiInsight) data.aiInsight = "Analysis completed. Review the nutritional details below.";
  if (!data.viralStatement) data.viralStatement = "Know what you eat.";
  if (!Array.isArray(data.alternatives)) data.alternatives = [];

  // ── Food-specific optional fields ───────────────────────────────────────────
  if (!data.digestiveLoad) data.digestiveLoad = "moderate";
  if (typeof data.nutrientDensity !== "number") data.nutrientDensity = 50;
  if (!data.fiberEstimate) data.fiberEstimate = "low";
  if (!data.proteinQuality) data.proteinQuality = "not_applicable";
  if (!data.bloodSugarTrajectory) data.bloodSugarTrajectory = "gradual";
  if (!data.processingLevel) data.processingLevel = "processed";
  if (!data.mealType) data.mealType = "snack";
  if (!Array.isArray(data.allergenFlags)) data.allergenFlags = [];
  if (!Array.isArray(data.componentBreakdown)) data.componentBreakdown = [];
  if (!data.mealTimingFit || typeof data.mealTimingFit !== "object") {
    data.mealTimingFit = { breakfast: "fair", lunch: "fair", dinner: "fair", snack: "fair" };
  }

  // ── Impact objects ───────────────────────────────────────────────────────────
  if (!data.shortTermImpact || typeof data.shortTermImpact !== "object") {
    data.shortTermImpact = {
      energyResponse: "Energy impact estimated based on nutritional profile.",
      bloodSugarResponse: "Blood sugar response estimated.",
      bodyReaction: "General physiological response noted.",
      hydrationImpact: "Hydration impact assessed.",
    };
  } else {
    const s = data.shortTermImpact as Record<string, unknown>;
    if (!s.energyResponse) s.energyResponse = "Energy impact estimated.";
    if (!s.bloodSugarResponse) s.bloodSugarResponse = "Blood sugar response estimated.";
    if (!s.bodyReaction) s.bodyReaction = "Physiological response noted.";
    if (!s.hydrationImpact) s.hydrationImpact = "Hydration impact assessed.";
  }
  if (!data.mediumTermImpact || typeof data.mediumTermImpact !== "object") {
    data.mediumTermImpact = {
      energyStability: "Energy stability pattern observed.",
      physicalChanges: "Physical changes monitored over weeks.",
      habitRisk: "Habit formation potential assessed.",
      sleepQuality: "Sleep quality impact estimated.",
    };
  } else {
    const m = data.mediumTermImpact as Record<string, unknown>;
    if (!m.energyStability) m.energyStability = "Energy stability pattern observed.";
    if (!m.physicalChanges) m.physicalChanges = "Physical changes monitored.";
    if (!m.habitRisk) m.habitRisk = "Habit formation assessed.";
    if (!m.sleepQuality) m.sleepQuality = "Sleep quality impact estimated.";
  }
  if (!data.longTermImpact || typeof data.longTermImpact !== "object") {
    data.longTermImpact = {
      healthTrend: "Long-term health trend analyzed.",
      metabolicImpact: "Metabolic impact assessed.",
      riskAccumulation: "Risk accumulation evaluated.",
      nutritionalBalance: "Nutritional balance reviewed.",
    };
  } else {
    const l = data.longTermImpact as Record<string, unknown>;
    if (!l.healthTrend) l.healthTrend = "Long-term health trend analyzed.";
    if (!l.metabolicImpact) l.metabolicImpact = "Metabolic impact assessed.";
    if (!l.riskAccumulation) l.riskAccumulation = "Risk accumulation evaluated.";
    if (!l.nutritionalBalance) l.nutritionalBalance = "Nutritional balance reviewed.";
  }

  // ── Composition ──────────────────────────────────────────────────────────────
  if (!data.composition || typeof data.composition !== "object") {
    data.composition = {
      calories: 0, sugarGrams: 0, caffeineMg: 0, sodiumMg: 0,
      fatGrams: 0, proteinGrams: 0, fiberGrams: 0,
      servingSize: 100, servingUnit: "g",
      artificialSweeteners: false, additives: [], ingredients: [],
    };
  } else {
    const c = data.composition as Record<string, unknown>;
    // Coerce string numbers to actual numbers — AI sometimes returns "420" instead of 420
    const toNum = (v: unknown, fallback: number): number => {
      if (typeof v === "number") return isNaN(v) ? fallback : v;
      if (typeof v === "string") { const n = parseFloat(v); return isNaN(n) ? fallback : n; }
      return fallback;
    };
    // Use -1 sentinel so we can detect truly missing values vs intentional zero (water)
    c.calories    = toNum(c.calories,    -1); if ((c.calories as number) < 0) c.calories = null;
    c.carbsGrams  = toNum(c.carbsGrams,  -1); if ((c.carbsGrams as number) < 0) c.carbsGrams = null;
    c.sugarGrams  = toNum(c.sugarGrams,  -1); if ((c.sugarGrams as number) < 0) c.sugarGrams = null;
    c.caffeineMg  = toNum(c.caffeineMg,   0);
    c.sodiumMg    = toNum(c.sodiumMg,    -1); if ((c.sodiumMg as number) < 0) c.sodiumMg = null;
    c.fatGrams    = toNum(c.fatGrams,    -1); if ((c.fatGrams as number) < 0) c.fatGrams = null;
    c.proteinGrams= toNum(c.proteinGrams,-1); if ((c.proteinGrams as number) < 0) c.proteinGrams = null;
    c.fiberGrams  = toNum(c.fiberGrams,  -1); if ((c.fiberGrams as number) < 0) c.fiberGrams = null;
    c.servingSize = toNum(c.servingSize, 100); if ((c.servingSize as number) <= 0) c.servingSize = 100;
    if (!c.servingUnit) c.servingUnit = "g";
    if (typeof c.artificialSweeteners !== "boolean") c.artificialSweeteners = false;
    if (!Array.isArray(c.additives)) c.additives = [];
    if (!Array.isArray(c.ingredients)) c.ingredients = [];
  }

  // ── Low-confidence prefix ────────────────────────────────────────────────────
  const conf = data.confidenceScore as number;
  if (conf < 0.6) {
    const name = data.detectedProduct as string;
    if (!name.toLowerCase().startsWith("possible") && !name.toLowerCase().startsWith("unidentified")) {
      data.detectedProduct = `Possible ${name}`;
    }
  }

  return data;
}

// ─── Phase 1: Fast vision call (gpt-4o-mini + detail:low) ────────────────────
// Targets 2-3s by using a smaller model, minimal image tokens, and compact output.
async function callAIVision(imageBase64: string): Promise<Record<string, unknown>> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 30_000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: FAST_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" } },
              { type: "text", text: FAST_USER_PROMPT },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.1,
      },
      { signal: abortController.signal as AbortSignal },
    );
    clearTimeout(timeoutId);
    return extractAndNormalize(completion.choices[0]?.message?.content ?? "");
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw err instanceof Error ? err : new Error(String(err));
  }
}

// ─── Phase 2: Text-only enhance call (no image, fast, background) ─────────────
async function callAIEnhance(
  detectedProduct: string,
  category: string,
  consumableType: string,
  composition: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 45_000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: ENHANCE_SYSTEM_PROMPT },
          { role: "user", content: buildEnhanceUserPrompt(detectedProduct, category, consumableType, composition) },
        ],
        max_tokens: 1400,
        temperature: 0.2,
      },
      { signal: abortController.signal as AbortSignal },
    );
    clearTimeout(timeoutId);
    const raw = completion.choices[0]?.message?.content ?? "";
    return extractAndNormalize(raw);
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    logger.warn({ err }, "enhance call failed");
    return {};
  }
}

// ─── Analyze endpoint ─────────────────────────────────────────────────────────
router.post("/scans/analyze", async (req, res) => {
  const t0 = Date.now();
  try {
    const { imageBase64, ocrText, productHint, barcode } = req.body as {
      imageBase64?: string;
      ocrText?: string;
      productHint?: string;
      barcode?: string;
    };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    const searchText = [productHint, ocrText].filter(Boolean).join(" ").trim();
    const imageHash = computeImageHash(imageBase64);

    // ═══ LAYER 0 — In-memory LRU cache (<1ms) ═══════════════════════════════
    const memImageHit = getCachedByImageHash(imageHash);
    if (memImageHit) {
      logger.info({ ms: Date.now() - t0 }, "L0 HIT: image hash");
      res.json(memImageHit);
      return;
    }
    if (barcode) {
      const memBarcodeHit = getCachedByBarcode(barcode);
      if (memBarcodeHit) {
        logger.info({ ms: Date.now() - t0 }, "L0 HIT: barcode");
        res.json(memBarcodeHit);
        return;
      }
    }
    if (searchText.length > 2) {
      const memFingerprintHit = getCachedByFingerprint(buildFingerprint(searchText));
      if (memFingerprintHit) {
        logger.info({ ms: Date.now() - t0 }, "L0 HIT: fingerprint");
        res.json(memFingerprintHit);
        return;
      }
      const keywordHit = lookupBeverageByKeywords(searchText);
      if (keywordHit) {
        logger.info({ ms: Date.now() - t0 }, "L0 HIT: keyword cache");
        res.json(keywordHit);
        return;
      }
    }

    // ═══ LAYER 1 — PostgreSQL product DB (5–20ms) ════════════════════════════
    const fingerprint = searchText.length > 2 ? buildFingerprint(searchText) : "";
    const [dbImageHit, dbBarcodeHit, dbFingerprintHit] = await Promise.all([
      dbLookupByImageHash(imageHash),
      barcode ? dbLookupByBarcode(barcode) : Promise.resolve(null),
      fingerprint ? dbLookupByFingerprint(fingerprint) : Promise.resolve(null),
    ]);
    const l1Hit = dbImageHit || dbBarcodeHit || dbFingerprintHit;
    if (l1Hit) {
      logger.info({ ms: Date.now() - t0 }, "L1 HIT: products DB");
      res.json(l1Hit);
      return;
    }

    // ═══ LAYER 2 — Open Food Facts (200–800ms, free, no AI cost) ═════════════
    const [offBarcodeHit, offNameHit] = await Promise.all([
      barcode ? offLookupByBarcode(barcode) : Promise.resolve(null),
      searchText.length > 3 && !barcode ? offSearchByName(searchText) : Promise.resolve(null),
    ]);
    const l2Hit = offBarcodeHit || offNameHit;
    if (l2Hit) {
      logger.info({ ms: Date.now() - t0 }, "L2 HIT: Open Food Facts");
      await saveProduct(l2Hit, { imageHash, barcode: barcode ?? undefined, source: "openfoodfacts" });
      res.json(l2Hit);
      return;
    }

    // ═══ LAYER 3 — Direct GPT-4o Vision (3–8s) ════════════════════════════════
    // Uses text extraction instead of response_format:json_object to avoid the
    // "messages must contain 'json'" 400 error. Robust manual defaults applied.
    logger.info({ ms: Date.now() - t0, barcode }, "L3: calling AI vision (gpt-4o-mini + detail:low)");
    const result = await callAIVision(imageBase64);

    logger.info({
      ms: Date.now() - t0,
      product: result.detectedProduct,
      confidence: result.confidenceScore,
      consumableType: result.consumableType,
    }, "L3: AI analysis complete");

    // Persist for next identical scan (L0/L1 will hit instead of AI)
    void saveProduct(result as any, {
      imageHash,
      barcode: barcode ?? undefined,
      source: "ai",
    });

    res.json(result);
  } catch (err: any) {
    if (err?.name === "AbortError") {
      logger.warn("AI analysis timed out");
      res.status(504).json({ error: "Analysis timed out — try with a clearer photo" });
      return;
    }
    logger.error({ err }, "Failed to analyze scan");
    res.status(500).json({ error: err.message || "Failed to analyze image" });
  }
});

// ─── Phase 2: Enhance endpoint (text-only, background, no image) ──────────────
// Called by the client after showing Phase 1 results. Returns impact analysis.
router.post("/scans/enhance", async (req, res) => {
  const t0 = Date.now();
  try {
    const { detectedProduct, category, consumableType, composition } = req.body as {
      detectedProduct?: string;
      category?: string;
      consumableType?: string;
      composition?: Record<string, unknown>;
    };

    if (!detectedProduct || typeof detectedProduct !== "string") {
      res.status(400).json({ error: "detectedProduct is required" });
      return;
    }

    const impact = await callAIEnhance(
      detectedProduct,
      category ?? "other",
      consumableType ?? "beverage",
      composition ?? {},
    );

    logger.info({ ms: Date.now() - t0, product: detectedProduct }, "enhance complete");

    res.json({
      shortTermImpact: impact.shortTermImpact,
      mediumTermImpact: impact.mediumTermImpact,
      longTermImpact: impact.longTermImpact,
    });
  } catch (err: any) {
    logger.error({ err }, "enhance endpoint failed");
    res.status(500).json({ error: err.message || "Failed to generate impact analysis" });
  }
});

// ─── Save a scan to cloud (requires auth) ────────────────────────────────────
router.post("/scans/save", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  let userId: string;
  try {
    const payload = verifyAccessToken(header.slice(7));
    userId = payload.userId;
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const scan = req.body as Record<string, unknown>;
    if (!scan?.id || typeof scan.id !== "string") {
      return res.status(400).json({ error: "scan.id is required" });
    }
    await db.insert(scansTable).values({
      id: scan.id as string,
      userId,
      detectedProduct: (scan.detectedProduct as string) ?? "Unknown",
      brand: (scan.brand as string | null) ?? null,
      category: (scan.category as string) ?? "other",
      liquidType: (scan.liquidType as string) ?? "beverage",
      consumableType: (scan.consumableType as string | null) ?? null,
      confidenceScore: (scan.confidenceScore as number) ?? 0.7,
      impactScore: (scan.impactScore as number) ?? 0,
      hydrationLevel: (scan.hydrationLevel as number) ?? 0,
      glycemicImpact: (scan.glycemicImpact as string) ?? "moderate",
      status: (scan.status as string) ?? "stable",
      dehydrationRisk: (scan.dehydrationRisk as boolean) ?? false,
      aiInsight: (scan.aiInsight as string) ?? "",
      viralStatement: (scan.viralStatement as string | null) ?? null,
      alternatives: (scan.alternatives as string[]) ?? [],
      shortTermImpact: scan.shortTermImpact as object,
      mediumTermImpact: scan.mediumTermImpact as object,
      longTermImpact: scan.longTermImpact as object,
      composition: scan.composition as object,
      satietyScore: (scan.satietyScore as number | null) ?? null,
      digestiveLoad: (scan.digestiveLoad as string | null) ?? null,
      nutrientDensity: (scan.nutrientDensity as number | null) ?? null,
      fiberEstimate: (scan.fiberEstimate as string | null) ?? null,
      proteinQuality: (scan.proteinQuality as string | null) ?? null,
      mealTimingFit: scan.mealTimingFit ? (scan.mealTimingFit as object) : null,
      bloodSugarTrajectory: (scan.bloodSugarTrajectory as string | null) ?? null,
      componentBreakdown: scan.componentBreakdown ? (scan.componentBreakdown as object) : null,
      allergenFlags: scan.allergenFlags ? (scan.allergenFlags as string[]) : null,
      processingLevel: (scan.processingLevel as string | null) ?? null,
      mealType: (scan.mealType as string | null) ?? null,
      scannedAt: scan.scannedAt ? new Date(scan.scannedAt as number) : new Date(),
    }).onConflictDoNothing();

    logger.info({ userId, scanId: scan.id }, "Scan saved to cloud");
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to save scan");
    return res.status(500).json({ error: "Failed to save scan" });
  }
});

// ─── Fetch user's cloud scans (requires auth) ────────────────────────────────
router.get("/scans", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  let userId: string;
  try {
    const payload = verifyAccessToken(header.slice(7));
    userId = payload.userId;
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const rows = await db.select().from(scansTable)
      .where(eq(scansTable.userId, userId))
      .orderBy(desc(scansTable.scannedAt))
      .limit(200);

    const scans = rows.map((r) => ({
      id: r.id,
      detectedProduct: r.detectedProduct,
      brand: r.brand,
      category: r.category,
      liquidType: r.liquidType,
      consumableType: r.consumableType,
      confidenceScore: r.confidenceScore,
      impactScore: r.impactScore,
      hydrationLevel: r.hydrationLevel,
      glycemicImpact: r.glycemicImpact,
      status: r.status,
      dehydrationRisk: r.dehydrationRisk,
      aiInsight: r.aiInsight,
      viralStatement: r.viralStatement,
      alternatives: r.alternatives,
      shortTermImpact: r.shortTermImpact,
      mediumTermImpact: r.mediumTermImpact,
      longTermImpact: r.longTermImpact,
      composition: r.composition,
      scannedAt: r.scannedAt.getTime(),
      satietyScore: r.satietyScore,
      digestiveLoad: r.digestiveLoad,
      nutrientDensity: r.nutrientDensity,
      fiberEstimate: r.fiberEstimate,
      proteinQuality: r.proteinQuality,
      mealTimingFit: r.mealTimingFit,
      bloodSugarTrajectory: r.bloodSugarTrajectory,
      componentBreakdown: r.componentBreakdown,
      allergenFlags: r.allergenFlags,
      processingLevel: r.processingLevel,
      mealType: r.mealType,
    }));

    return res.json({ scans });
  } catch (err) {
    logger.error({ err }, "Failed to fetch scans");
    return res.status(500).json({ error: "Failed to fetch scans" });
  }
});

export default router;
