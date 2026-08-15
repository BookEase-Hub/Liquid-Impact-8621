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
import { generateScanId } from "../services/schema/analysis.schema";
import { guardAnalysis } from "../services/intelligence/analysis-guard";

const router = Router();

// ─── Phase 1: Fast identification prompt (gpt-4o-mini, detail:low) ─────────────
// Target: one compact vision call. Detailed enrichment stays off the critical path.
const FAST_SYSTEM_PROMPT = `You are a fast food and drink analyzer. Return ONLY valid JSON — no markdown, no preamble.

RULES:
• Identify foods and drinks globally. Consider regional cuisine, preparation style, serving method, packaging, label/OCR, container, texture, and visible components. Do not assume an unfamiliar dish is a familiar local food.
• First produce 2-5 plausible candidates and visual evidence, then select only the best-supported candidate. Similar appearance is not enough for confidence.
• For mixed meals, identify visible components separately and estimate portions. Mark ingredients as visually detected, likely, or unknown.
• CONDIMENT: consumableType="condiment" ONLY for ketchup/hot sauce/soy sauce/mustard/mayo/vinegar/relish. NEVER for rice, ugali, chapati, stew, curry, soup, vegetables, meat, fish, fruit, or any meal.
• Nutrition comes only after identity and portion reasoning. Calories ≈ protein×4 + carbs×4 + fat×9 (±10%). Never output 0 for real food — only plain water may be zero kcal. If identity, ingredients, or portion are uncertain, return null and explain why. Scale to the serving size VISIBLE in the image, not per 100g.
• Scoring: impactScore 0–100 (higher=healthier). Calculate it from this item's nutrients, processing, portion, hydration, sugar, sodium, caffeine, alcohol, fiber and protein; do not reuse a stock score. Status: optimal(80+) stable(50–79) risky(25–49) damaging(0–24).
• Quick reference: Coca-Cola 330ml=139kcal/35g carbs; banana=107kcal/27g carbs; ugali 200g=260kcal/58g carbs; chicken breast 150g=248kcal/47g protein; full meal plate=400–900kcal.`;

const FAST_USER_PROMPT = `Identify the food or drink in this image. Return ONLY this JSON object:

{
  "detectedProduct": "<specific name only when supported; otherwise 'Possible <category>' or 'Unidentified food or drink'>",
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
  "identificationCandidates": [{"name":"<candidate>","confidence":0.0,"evidence":"visual|likely|unknown"}],
  "visualEvidence": ["<what is actually visible>"],
  "confirmedIngredients": ["<only directly visible or labeled ingredients>"],
  "uncertainIngredients": ["<hidden or unconfirmed ingredients>"],
  "portionConfidence": 0.0,
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

   // If we still have nothing, build an honest low-confidence result so the user
   // never sees fabricated nutrition.
  if (!data) {
    logger.warn({ rawLen: raw.length, rawSnippet: raw.slice(0, 200) }, "AI returned no parseable JSON — using fallback");
    data = {};
  }

  // ── ID ──────────────────────────────────────────────────────────────────────
  // The model's ID is not a scan identity. A new API response must always get
  // a new ID, including direct AI results and malformed-output recovery.
  data.id = generateScanId();

  // ── Core scalars ────────────────────────────────────────────────────────────
  if (!data.detectedProduct) data.detectedProduct = "Unidentified food or drink";
  if (data.brand === undefined) data.brand = null;
  if (!data.category) data.category = "other";
  if (!data.liquidType) data.liquidType = "beverage";
  if (!data.consumableType) data.consumableType = "beverage";
   if (typeof data.confidenceScore !== "number") data.confidenceScore = 0.25;
  if (typeof data.impactScore !== "number") data.impactScore = 0;
  if (typeof data.hydrationLevel !== "number") data.hydrationLevel = 0;
  if (!data.glycemicImpact) data.glycemicImpact = "moderate";
  if (!data.status) {
    const s = data.impactScore as number;
    data.status = s >= 80 ? "optimal" : s >= 50 ? "stable" : s >= 25 ? "risky" : "damaging";
  }
  if (typeof data.dehydrationRisk !== "boolean") data.dehydrationRisk = false;
  if (!data.aiInsight) data.aiInsight = `We could not confidently identify ${data.detectedProduct}. Retake the photo with the full item visible and better lighting.`;
  if (!data.viralStatement) data.viralStatement = `A clearer image is needed to assess ${data.detectedProduct}.`;
  if (!Array.isArray(data.alternatives)) data.alternatives = [];

  // ── Food-specific optional fields ───────────────────────────────────────────
  if (!data.digestiveLoad) data.digestiveLoad = "moderate";
  if (typeof data.nutrientDensity !== "number") delete data.nutrientDensity;
  if (!data.fiberEstimate) delete data.fiberEstimate;
  if (!data.proteinQuality) {
    if (data.consumableType === "beverage") data.proteinQuality = "not_applicable";
    else delete data.proteinQuality;
  }
  if (!data.bloodSugarTrajectory) delete data.bloodSugarTrajectory;
  if (!data.processingLevel) delete data.processingLevel;
  if (!data.mealType) delete data.mealType;
  if (!Array.isArray(data.allergenFlags)) data.allergenFlags = [];
  if (!Array.isArray(data.componentBreakdown)) data.componentBreakdown = [];
  if (!data.mealTimingFit || typeof data.mealTimingFit !== "object") {
    data.mealTimingFit = { breakfast: "fair", lunch: "fair", dinner: "fair", snack: "fair" };
  }

  // ── Impact objects ───────────────────────────────────────────────────────────
  if (!data.shortTermImpact || typeof data.shortTermImpact !== "object") {
    data.shortTermImpact = {
      energyResponse: `The energy response of ${data.detectedProduct} could not be estimated confidently from this image.`,
      bloodSugarResponse: `The blood-sugar response of ${data.detectedProduct} depends on ingredients that were not confirmed.`,
      bodyReaction: `The body response to ${data.detectedProduct} may vary because its ingredients and portion were not fully visible.`,
      hydrationImpact: `The hydration effect of ${data.detectedProduct} could not be confirmed from this image.`,
    };
  } else {
    const s = data.shortTermImpact as Record<string, unknown>;
    if (!s.energyResponse) s.energyResponse = `The energy response of ${data.detectedProduct} could not be estimated confidently.`;
    if (!s.bloodSugarResponse) s.bloodSugarResponse = `The blood-sugar response of ${data.detectedProduct} could not be confirmed.`;
    if (!s.bodyReaction) s.bodyReaction = `The body response to ${data.detectedProduct} may vary with its ingredients and portion.`;
    if (!s.hydrationImpact) s.hydrationImpact = `The hydration effect of ${data.detectedProduct} could not be confirmed.`;
  }
  if (!data.mediumTermImpact || typeof data.mediumTermImpact !== "object") {
    data.mediumTermImpact = {
      energyStability: `Regular use of ${data.detectedProduct} cannot be assessed without more reliable nutrition data.`,
      physicalChanges: `The physical effects of ${data.detectedProduct} depend on portion and frequency, which were not confirmed.`,
      habitRisk: `Habit risk from ${data.detectedProduct} depends on caffeine, sugar, alcohol, and other compounds that may be hidden.`,
      sleepQuality: `Sleep effects from ${data.detectedProduct} cannot be estimated until its stimulant content is confirmed.`,
    };
  } else {
    const m = data.mediumTermImpact as Record<string, unknown>;
    if (!m.energyStability) m.energyStability = `Regular use of ${data.detectedProduct} cannot be assessed without more reliable nutrition data.`;
    if (!m.physicalChanges) m.physicalChanges = `The physical effects of ${data.detectedProduct} depend on portion and frequency.`;
    if (!m.habitRisk) m.habitRisk = `Habit risk from ${data.detectedProduct} could not be assessed from this image.`;
    if (!m.sleepQuality) m.sleepQuality = `Sleep effects from ${data.detectedProduct} could not be assessed from this image.`;
  }
  if (!data.longTermImpact || typeof data.longTermImpact !== "object") {
    data.longTermImpact = {
      healthTrend: `Long-term wellness effects of ${data.detectedProduct} cannot be projected responsibly from this image alone.`,
      metabolicImpact: `The metabolic impact of ${data.detectedProduct} is uncertain without verified nutrition.`,
      riskAccumulation: `Risk accumulation for ${data.detectedProduct} cannot be estimated at this confidence level.`,
      nutritionalBalance: `The nutritional balance of ${data.detectedProduct} is unavailable until its ingredients are confirmed.`,
    };
  } else {
    const l = data.longTermImpact as Record<string, unknown>;
    if (!l.healthTrend) l.healthTrend = `Long-term wellness effects of ${data.detectedProduct} cannot be projected responsibly.`;
    if (!l.metabolicImpact) l.metabolicImpact = `The metabolic impact of ${data.detectedProduct} is uncertain without verified nutrition.`;
    if (!l.riskAccumulation) l.riskAccumulation = `Risk accumulation for ${data.detectedProduct} cannot be estimated at this confidence level.`;
    if (!l.nutritionalBalance) l.nutritionalBalance = `The nutritional balance of ${data.detectedProduct} is unavailable until its ingredients are confirmed.`;
  }

  // ── Composition ──────────────────────────────────────────────────────────────
  if (!data.composition || typeof data.composition !== "object") {
    data.composition = {
       calories: null, carbsGrams: null, sugarGrams: null, caffeineMg: null, sodiumMg: null,
      fatGrams: null, proteinGrams: null, fiberGrams: null,
      servingSize: 1, servingUnit: "piece",
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
     c.caffeineMg  = toNum(c.caffeineMg,  -1); if ((c.caffeineMg as number) < 0) c.caffeineMg = null;
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

  const composition = data.composition as Record<string, unknown>;
  const isWater = data.category === "water" || /\bwater\b/i.test(String(data.detectedProduct));
  const confidence = typeof data.confidenceScore === "number" ? data.confidenceScore : 0;
  const unavailable = confidence < 0.7 && !isWater;
  if (unavailable) {
    data.nutritionEstimateUnavailable = true;
    for (const key of ["calories", "sugarGrams", "sodiumMg", "fatGrams", "proteinGrams", "fiberGrams", "caffeineMg"]) {
      if (composition[key] === 0) composition[key] = null;
    }
    data.uncertaintyNotes = [
      ...(Array.isArray(data.uncertaintyNotes) ? data.uncertaintyNotes : []),
      "Nutrition is unavailable because visual confidence is below 70%.",
    ];
  }

  data = guardAnalysis(data);
  deriveContextualMetrics(data);

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

function deriveContextualMetrics(data: Record<string, unknown>): void {
  const composition = data.composition as Record<string, unknown>;
  if (data.nutritionEstimateUnavailable) {
    data.impactScore = 0;
    data.status = "unknown";
    data.satietyScore = undefined;
    data.nutrientDensity = undefined;
    data.sugarLoadScore = undefined;
    data.caffeineScore = undefined;
    data.electrolyteScore = undefined;
    return;
  }
  const n = (key: string) => typeof composition[key] === "number" ? composition[key] as number : 0;
  const protein = n("proteinGrams");
  const fiber = n("fiberGrams");
  const sugar = n("sugarGrams");
  const fat = n("fatGrams");
  const sodium = n("sodiumMg");
  const calories = n("calories");
  const caffeine = n("caffeineMg");
  const isFood = ["solid_food", "mixed_meal", "snack"].includes(String(data.consumableType));
  const isCondiment = data.consumableType === "condiment" || data.category === "condiment";
  const hydration = typeof data.hydrationLevel === "number" ? data.hydrationLevel : 0;
  const base = isFood
    ? 55 + protein * 0.7 + fiber * 1.2 - sugar * 0.75 - sodium / 180 - calories / 900 - fat * 0.15
    : 45 + hydration * 0.25 - sugar * 0.9 - caffeine / 20 - sodium / 160;
  const score = Math.max(0, Math.min(100, Math.round(base - (isCondiment ? 8 : 0))));
  data.impactScore = score;
  data.status = score >= 80 ? "optimal" : score >= 50 ? "stable" : score >= 25 ? "risky" : "damaging";
  if (isFood) {
    data.satietyScore = Math.max(0, Math.min(100, Math.round(35 + protein * 2 + fiber * 2 - sugar * 0.4)));
    data.nutrientDensity = Math.max(0, Math.min(100, Math.round(45 + protein + fiber * 2 - calories / 80)));
    data.fiberEstimate = fiber >= 6 ? "high" : fiber >= 2 ? "medium" : "low";
    data.digestiveLoad = calories > 800 || fat > 35 ? "heavy" : calories > 400 ? "moderate" : "light";
    data.bloodSugarTrajectory = sugar > 25 ? "spike" : protein + fiber > 15 ? "sustained" : "gradual";
  } else {
    data.sugarLoadScore = Math.max(0, Math.min(100, Math.round(100 - sugar * 2.2)));
    data.hydrationScore = hydration;
    data.caffeineScore = Math.max(0, Math.min(100, Math.round(100 - caffeine / 4)));
    data.electrolyteScore = Math.max(0, Math.min(100, Math.round(sodium / 10)));
  }
}

// ─── Phase 1: Fast vision call (gpt-4o-mini + detail:low) ────────────────────
// Targets 2-3s by using a smaller model, minimal image tokens, and compact output.
async function callAIVision(imageBase64: string): Promise<Record<string, unknown>> {
  const abortController = new AbortController();
  // A scan is a fast interaction. If the provider misses the budget, return
  // an honest uncertainty result instead of keeping the camera flow blocked.
  const timeoutId = setTimeout(() => abortController.abort(), 1_200);

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
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn("AI vision missed the fast scan budget; returning uncertainty result");
      return extractAndNormalize("");
    }
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
      res.json(guardAnalysis(memImageHit));
      return;
    }
    if (barcode) {
      const memBarcodeHit = getCachedByBarcode(barcode);
      if (memBarcodeHit) {
        logger.info({ ms: Date.now() - t0 }, "L0 HIT: barcode");
        res.json(guardAnalysis(memBarcodeHit));
        return;
      }
    }
    if (searchText.length > 2) {
      const memFingerprintHit = getCachedByFingerprint(buildFingerprint(searchText));
      if (memFingerprintHit) {
        logger.info({ ms: Date.now() - t0 }, "L0 HIT: fingerprint");
        res.json(guardAnalysis(memFingerprintHit));
        return;
      }
      const keywordHit = lookupBeverageByKeywords(searchText);
      if (keywordHit) {
        logger.info({ ms: Date.now() - t0 }, "L0 HIT: keyword cache");
        res.json(guardAnalysis(keywordHit));
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
      res.json(guardAnalysis(l1Hit));
      return;
    }

    // ═══ LAYER 2 — Open Food Facts (bounded, free, no AI cost) ═══════════════
    const [offBarcodeHit, offNameHit] = await Promise.all([
      barcode ? offLookupByBarcode(barcode) : Promise.resolve(null),
      searchText.length > 3 && !barcode ? offSearchByName(searchText) : Promise.resolve(null),
    ]);
    const l2Hit = offBarcodeHit || offNameHit;
    if (l2Hit) {
      logger.info({ ms: Date.now() - t0 }, "L2 HIT: Open Food Facts");
      const guarded = guardAnalysis(l2Hit);
      void saveProduct(guarded as any, { imageHash, barcode: barcode ?? undefined, source: "openfoodfacts" });
      res.json(guarded);
      return;
    }

    // ═══ LAYER 3 — Direct GPT-4o Vision (fast bounded path) ═══════════════════
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
      imageUri: (scan.imageUri as string | null) ?? null,
      originalImageUri: (scan.originalImageUri as string | null) ?? null,
      compressedImageUri: (scan.compressedImageUri as string | null) ?? null,
      thumbnailUri: (scan.thumbnailUri as string | null) ?? null,
      imageHash: (scan.imageHash as string | null) ?? null,
      uncertaintyNotes: scan.uncertaintyNotes ? (scan.uncertaintyNotes as string[]) : null,
      nutritionEstimateUnavailable: (scan.nutritionEstimateUnavailable as boolean | null) ?? null,
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
      imageUri: r.imageUri,
      originalImageUri: r.originalImageUri,
      compressedImageUri: r.compressedImageUri,
      thumbnailUri: r.thumbnailUri,
      imageHash: r.imageHash,
      uncertaintyNotes: r.uncertaintyNotes,
      nutritionEstimateUnavailable: r.nutritionEstimateUnavailable,
    }));

    return res.json({ scans });
  } catch (err) {
    logger.error({ err }, "Failed to fetch scans");
    return res.status(500).json({ error: "Failed to fetch scans" });
  }
});

export default router;
