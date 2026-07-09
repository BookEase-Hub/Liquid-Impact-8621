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

// ─── Prompts — verbose enough to satisfy OpenAI json_object requirement ────────
// CRITICAL: The word "JSON" must appear in messages for response_format:json_object.
// We embed a full JSON template in the user prompt to guarantee this and guide output.
const ANALYSIS_SYSTEM_PROMPT = `You are an elite food and beverage analyst with encyclopaedic knowledge of global products, nutrition science, and health impact.
You ALWAYS return a single valid JSON object — no markdown fences, no preamble, no trailing text.

━━━ PRODUCT IDENTIFICATION — ABSOLUTE RULES ━━━
• YOU MUST identify every product. "Unknown Item" is NEVER acceptable as a final answer.
• Use ALL visual evidence: brand logos, label colours, packaging shape, font style, product colour, container type, any visible text or barcode.
• If you can only see part of the label, infer from what's visible — e.g. red-and-silver can with bull logo = "Red Bull Energy Drink".
• Confident identification: use the exact product name (e.g. "Coca-Cola Classic 330ml", "Lay's Classic Chips", "Grilled Chicken Caesar Salad").
• Partial identification: use "Possible [Best Guess]" (e.g. "Possible Energy Drink", "Possible Dark Chocolate Bar").
• Completely unidentifiable: use the most specific category possible (e.g. "Brown Carbonated Beverage", "Fried Snack Food", "Fresh Salad Bowl") — never plain "Unknown".
• Set confidenceScore: 0.95+ = certain, 0.80–0.94 = highly likely, 0.65–0.79 = probable, 0.50–0.64 = best guess, below 0.5 = category-only.

━━━ CLASSIFICATION ━━━
consumableType: beverage | solid_food | mixed_meal | snack | condiment | supplement
category: water | soda | energy_drink | tea | coffee | juice | alcohol | sports_drink | dairy | plant_milk | supplement | cooking_oil | solid_food | mixed_meal | snack | condiment | other

━━━ IMPACT SCORES (0–100, higher = healthier) ━━━
Beverages: water 95 | herbal tea 88 | green tea 82 | black coffee 74 | fresh juice 72 | oat milk 65 | sports drink 50 | packaged juice 48 | soda 22 | energy drink 18 | beer 20 | spirits 12
Foods: leafy greens 90 | whole fruit 88 | legumes 82 | lean protein 78 | whole grains 75 | eggs 72 | dairy 65 | processed snack 38 | fast food 28 | fried food 30 | candy 15
STATUS: optimal(80–100) | stable(50–79) | risky(25–49) | damaging(0–24)
PROCESSING: whole → minimally_processed → processed → ultra_processed

━━━ IMPACT FIELDS — MANDATORY DETAIL ━━━
Each of the 12 impact text fields MUST be 3–4 sentences, minimum 60 words, written in accessible scientific language.
Cover mechanisms, timeframes, and use hedged language ("may", "research suggests", "appears to", "estimated").
Never use one-liners. These are the core value of the product.`;

const ANALYSIS_USER_PROMPT = `Look carefully at this image. Identify the product using every visual clue available — brand logo, label text, packaging colour, container type, product appearance.

CRITICAL: You MUST provide a specific product name. Never return "Unknown Item". Use your best inference from visual evidence.

CRITICAL NUTRITION RULES (read before writing composition):
• NEVER output 0 for calories, protein, fat, or carbs unless the item is literally calorie-free water.
• Every real food or drink has non-zero nutrition. A full meal plate has 400–800+ kcal. A soda has 100–150 kcal. A snack bar has 200–300 kcal. A banana has ~90 kcal.
• Calories must be consistent with macros: roughly (protein×4) + (carbs×4) + (fat×9) ≈ calories.
• Estimate from standard food composition databases (USDA, NUTTAB, regional databases).
• For mixed meals: estimate total for the full plate visible (not per 100g).
• Portion size must always be estimated — never leave it at 0.

Return ONLY this JSON object — no markdown, no extra text:

{
  "id": "scan_XXXXXXXX",
  "detectedProduct": "<REQUIRED: specific name like 'Coca-Cola Classic', 'Red Bull Energy Drink', 'Grilled Chicken Caesar Salad', 'Banana', 'Mbuzi Wet Fry with Ugali and Sukuma Wiki' — NEVER 'Unknown Item'>",
  "brand": "<visible brand name, or null for fresh/home-cooked food>",
  "category": "<water|soda|energy_drink|tea|coffee|juice|alcohol|sports_drink|dairy|plant_milk|supplement|solid_food|mixed_meal|snack|condiment|other>",
  "liquidType": "<beverage|cooking_oil|condiment|alcohol|supplement|other>",
  "consumableType": "<beverage|solid_food|mixed_meal|snack|condiment|supplement>",
  "confidenceScore": 0.88,
  "impactScore": 62,
  "hydrationLevel": 45,
  "glycemicImpact": "moderate",
  "status": "stable",
  "dehydrationRisk": false,
  "satietyScore": 75,
  "digestiveLoad": "moderate",
  "nutrientDensity": 65,
  "fiberEstimate": "medium",
  "proteinQuality": "complete",
  "mealTimingFit": { "breakfast": "fair", "lunch": "excellent", "dinner": "good", "snack": "poor" },
  "bloodSugarTrajectory": "gradual",
  "componentBreakdown": [],
  "allergenFlags": [],
  "processingLevel": "minimally_processed",
  "mealType": "lunch",
  "aiInsight": "<3-4 sentences describing THIS SPECIFIC food/drink: what it contains, its key nutritional strengths and weaknesses, and what the user should know. Reference the actual ingredients visible. Min 80 words. NOT generic placeholder text.>",
  "viralStatement": "<punchy 8-12 word health truth specific to this item>",
  "alternatives": ["<specific healthier alternative>", "<specific healthier alternative>"],
  "shortTermImpact": {
    "energyResponse": "<Write 3-4 sentences specific to THIS food/drink. Describe: what happens to blood glucose in the first 1-4 hours from the actual carbs/sugars present, any caffeine or stimulant effects, expected energy curve, and when any crash might occur. Be specific — mention the actual ingredients. Min 80 words.>",
    "bloodSugarResponse": "<Write 3-4 sentences on the glycaemic trajectory of THIS item specifically. Estimate the glycaemic index of the main carb source, describe insulin demand, risk of spike-and-crash, absorption speed. Name the actual sugars or starches present. Min 80 words.>",
    "bodyReaction": "<Write 3-4 sentences on the immediate physiological reactions to THIS food/drink in the first few hours: digestive effort required, gut motility effect, any inflammation potential from specific ingredients, bloating risk, satiety signals. Be specific. Min 80 words.>",
    "hydrationImpact": "<Write 3-4 sentences on the net hydration effect of THIS item: is it hydrating or diuretic, what electrolytes does it provide or deplete, how does it affect fluid balance. For solid foods, describe water content contribution. Min 80 words.>"
  },
  "mediumTermImpact": {
    "energyStability": "<Write 3-4 sentences specific to THIS food/drink consumed regularly over 7-30 days. What happens to energy levels, adrenal function, cortisol rhythm, mitochondrial health. Mention the specific macros driving these effects. Min 80 words.>",
    "physicalChanges": "<Write 3-4 sentences on body composition changes from regular consumption of THIS item: weight gain/loss potential from its specific caloric density, water retention effects, muscle protein synthesis contribution from protein content, any visible skin effects. Min 80 words.>",
    "habitRisk": "<Write 3-4 sentences on dependency risk specific to THIS item: does it contain caffeine, high sugar, or other habit-forming compounds? What withdrawal effects might occur? How addictive is the consumption pattern it creates? Min 80 words.>",
    "sleepQuality": "<Write 3-4 sentences on sleep impact from regular consumption of THIS item: does it contain caffeine or stimulants that disrupt adenosine? Does the glycaemic load cause nocturnal blood sugar swings? What is the ideal cutoff time for this specific item? Min 80 words.>"
  },
  "longTermImpact": {
    "healthTrend": "<Write 3-4 sentences on the 1-5 year health trajectory of regularly consuming THIS food/drink. Reference specific epidemiological findings for this food category. Name cardiovascular, inflammatory, or longevity markers that this item specifically affects. Min 80 words.>",
    "metabolicImpact": "<Write 3-4 sentences on the metabolic consequences of regularly consuming THIS item: insulin sensitivity trajectory, hepatic fat risk from specific ingredients like fructose, lipid profile effects (LDL, HDL, triglycerides), visceral fat accumulation probability. Min 80 words.>",
    "riskAccumulation": "<Write 3-4 sentences on chronic disease risk from THIS specific food/drink: any known cancer associations for its processing level or additives, cardiovascular disease risk from fat type and sodium, diabetes risk from sugar load, kidney/liver stress. Min 80 words.>",
    "nutritionalBalance": "<Write 3-4 sentences on THIS item's long-term nutritional contribution: its micronutrient density, whether regular consumption supports or displaces healthier foods, key vitamins/minerals it provides or depletes, and its gut microbiome effects over months/years. Min 80 words.>"
  },
  "composition": {
    "calories": 420,
    "sugarGrams": 12,
    "caffeineMg": 0,
    "sodiumMg": 380,
    "fatGrams": 18,
    "proteinGrams": 32,
    "fiberGrams": 4,
    "servingSize": 350,
    "servingUnit": "g",
    "artificialSweeteners": false,
    "additives": [],
    "ingredients": [
      {
        "name": "<primary ingredient name>",
        "function": "<what this ingredient does in the body>",
        "healthRole": "<positive|neutral|concerning>",
        "riskLevel": "<low|medium|high>",
        "description": "<one sentence: what it is and its nutritional role>",
        "aiNote": "<specific actionable health insight about this ingredient>"
      }
    ]
  }
}

FINAL CHECK before outputting: Are calories > 0 for any real food/drink? Are protein, fat realistic for what you see? Are insights specific to THIS item (not generic)? If any field looks like a placeholder, rewrite it.`;

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

// ─── Focused ID prompt used when main analysis returns a weak name ─────────────
const IDENTIFY_PROMPT = `What food or drink product is in this image? Look at the logo, label text, packaging colours, and container shape.
Return ONLY a JSON object with these fields:
{"detectedProduct": "<specific name>", "brand": "<brand or null>", "confidenceScore": 0.8, "category": "<category>", "consumableType": "<consumableType>"}
Examples: {"detectedProduct":"Red Bull Energy Drink","brand":"Red Bull","confidenceScore":0.97,"category":"energy_drink","consumableType":"beverage"}
{"detectedProduct":"Grilled Chicken Sandwich","brand":null,"confidenceScore":0.85,"category":"solid_food","consumableType":"solid_food"}
NEVER return "Unknown Item" — use your best visual inference.`;

function isWeakName(name: unknown): boolean {
  if (typeof name !== "string") return true;
  const lower = name.toLowerCase();
  return (
    lower === "unknown item" ||
    lower === "unknown" ||
    lower === "unknown food" ||
    lower === "unknown drink" ||
    lower === "item" ||
    lower === "food" ||
    lower === "drink" ||
    lower === "product" ||
    lower.trim().length === 0
  );
}

async function identifyProductOnly(imageBase64: string): Promise<Partial<Record<string, unknown>>> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "auto" } },
            { type: "text", text: IDENTIFY_PROMPT },
          ],
        }],
        max_tokens: 200,
        temperature: 0.2,
      },
      { signal: ctrl.signal as AbortSignal },
    );
    clearTimeout(tid);
    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      return JSON.parse(cleaned.slice(start, end + 1)) as Partial<Record<string, unknown>>;
    }
  } catch (e) {
    clearTimeout(tid);
    logger.warn({ err: (e as Error).message }, "identifyProductOnly failed");
  }
  return {};
}

// ─── Direct AI call — no response_format wrapper, extract JSON from text ────────
async function callAIVision(imageBase64: string): Promise<Record<string, unknown>> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 65_000);

  let result: Record<string, unknown>;

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o",
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "auto" } },
              { type: "text", text: ANALYSIS_USER_PROMPT },
            ],
          },
        ],
        max_tokens: 3200,
        temperature: 0.15,
        // No response_format — JSON extracted via brace-matching to avoid 400 error
      },
      { signal: abortController.signal as AbortSignal },
    );
    clearTimeout(timeoutId);
    result = extractAndNormalize(completion.choices[0]?.message?.content ?? "");
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw err instanceof Error ? err : new Error(String(err));
  }

  // ── Smart retry: if the main call returned a weak product name, run a fast focused ID call ──
  if (isWeakName(result.detectedProduct)) {
    logger.warn({ name: result.detectedProduct }, "Weak product name — running focused ID retry");
    const idResult = await identifyProductOnly(imageBase64);
    if (idResult.detectedProduct && !isWeakName(idResult.detectedProduct)) {
      result.detectedProduct = idResult.detectedProduct;
      if (idResult.brand !== undefined) result.brand = idResult.brand;
      if (typeof idResult.confidenceScore === "number") result.confidenceScore = idResult.confidenceScore;
      if (idResult.category) result.category = idResult.category;
      if (idResult.consumableType) result.consumableType = idResult.consumableType;
      logger.info({ name: result.detectedProduct }, "ID retry succeeded");
    }
  }

  return result;
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
    logger.info({ ms: Date.now() - t0, barcode }, "L3: calling GPT-4o vision");
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
