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

// ─── Prompts ───────────────────────────────────────────────────────────────────
const ANALYSIS_SYSTEM_PROMPT = `You are an elite AI nutritionist, food scientist, and dietitian with encyclopaedic knowledge of global cuisines, food composition databases (USDA, NUTTAB, IFCT, FAO/INFOODS, regional databases), and clinical nutrition.
You ALWAYS return a single valid JSON object — no markdown fences, no preamble, no trailing text.

━━━ STEP 1: IDENTIFY ━━━
Use every visual cue: brand logos, label text, packaging colour/shape, product colour, cooking method, garnish, plating style, container type, barcodes, any visible text.
• Exact identification → use precise product name: "Coca-Cola Classic 330ml", "Grilled Chicken Breast with Steamed Broccoli", "Ugali with Nyama Choma and Sukuma Wiki"
• Partial identification → "Possible [best guess]": "Possible Mango Lassi", "Possible Lamb Kebab Platter"
• Unknown item → most specific category: "Brown Carbonated Beverage in Green Bottle", "Fried Dough Pastry" — NEVER plain "Unknown Item" or "Unknown Food"
• confidenceScore: 0.95+ brand+label visible | 0.85–0.94 clear identifiable food | 0.70–0.84 probable match | 0.60–0.69 best guess | <0.60 visual category only

━━━ STEP 2: CLASSIFY ━━━
consumableType: beverage | solid_food | mixed_meal | snack | condiment | supplement
category: water|soda|energy_drink|tea|coffee|juice|alcohol|sports_drink|dairy|plant_milk|supplement|cooking_oil|solid_food|mixed_meal|snack|condiment|other
⚠️ CONDIMENT RULE: Only use consumableType="condiment" for actual condiments (ketchup, hot sauce, soy sauce, mustard, mayonnaise, chilli paste, vinegar, relish).
   NEVER use condiment for: rice, ugali, chapati, stew, curry, soup, vegetables, meat, fish, fruit, any full meal, any substantial food.

━━━ STEP 3: ESTIMATE SERVING SIZE ━━━
Use visual container/plate size to estimate:
• Standard dinner plate (25–28cm): 300–700g total
• Smaller plate / bowl (15–20cm): 200–400g
• Standard can (330ml): 330g  |  Tall can (500ml): 500g
• Regular bottle (500ml): 500g  |  Large bottle (1L): 1000g
• Mug/cup (250ml): 250g  |  Tall glass (400ml): 400g
• Tumbler glass (300ml): 300g  |  Small glass (200ml): 200g
• Snack bag (standard): 28–50g  |  Chocolate bar: 40–50g
Scale all nutrition to the estimated serving, NOT per 100g.

━━━ STEP 4: NUTRITION ACCURACY ━━━
NEVER output 0 for calories, protein, fat, or carbs on real food. Only water = 0 calories.
Verify macros: calories ≈ (proteinGrams×4) + (carbsGrams×4) + (fatGrams×9). If they don't balance, recalculate.
Reference values (per serving):
• Full meal plate: 400–1200 kcal depending on composition
• Ugali (200g): ~260 kcal, 5g protein, 58g carbs, 1g fat
• Nyama Choma (150g): ~340 kcal, 38g protein, 0g carbs, 21g fat
• Sukuma Wiki / kale (80g cooked): ~45 kcal, 3g protein, 6g carbs, 1g fat
• Chapati (1 piece, 60g): ~180 kcal, 4g protein, 28g carbs, 6g fat
• Pilau rice (200g): ~280 kcal, 6g protein, 56g carbs, 4g fat
• Biryani (300g): ~480 kcal, 22g protein, 62g carbs, 14g fat
• White rice (200g cooked): ~260 kcal, 5g protein, 57g carbs, 0.4g fat
• Pumpkin stew (200g): ~90 kcal, 3g protein, 18g carbs, 2g fat
• Fried tilapia (150g): ~240 kcal, 30g protein, 8g carbs, 10g fat
• Jollof rice (250g): ~390 kcal, 10g protein, 72g carbs, 8g fat
• Fufu (200g): ~360 kcal, 4g protein, 84g carbs, 1g fat
• Banana (1 medium, 120g): ~107 kcal, 1.3g protein, 27g carbs, 0.4g fat
• Apple (1 medium, 180g): ~94 kcal, 0.5g protein, 25g carbs, 0.3g fat
• Mango (200g): ~130 kcal, 1.4g protein, 33g carbs, 0.5g fat
• Coca-Cola 330ml: 139 kcal, 0g protein, 35g carbs (sugar), 0g fat
• Orange juice 250ml: 112 kcal, 1.7g protein, 26g carbs, 0.5g fat
• Whole milk 250ml: 150 kcal, 8g protein, 12g carbs, 8g fat
• Coffee black 250ml: 5 kcal, 0.3g protein, 0g carbs, 0g fat
• Beer 330ml: 150 kcal, 1.3g protein, 13g carbs, 0g fat
• Energy drink 250ml: 110 kcal, 0g protein, 28g carbs, 0g fat

━━━ STEP 5: DYNAMIC SCORING (each item must receive UNIQUE scores) ━━━
impactScore = weighted average reflecting: nutrient density + processing level + sugar load + fat quality + protein adequacy + fiber + glycemic impact + sodium
Foods: leafy greens 88–92 | whole fruit 82–88 | legumes 78–84 | lean protein 72–80 | whole grains 70–76 | eggs 68–74 | dairy 62–68 | processed snack 32–42 | fast food 24–32 | fried food 28–36 | candy/sweets 12–22
Drinks: water 93–97 | herbal tea 86–90 | green tea 80–85 | black coffee 70–76 | fresh juice 68–74 | oat/nut milk 60–68 | sports drink 46–54 | packaged juice 44–50 | soda 18–26 | energy drink 14–22 | beer 16–24 | spirits 8–16
STATUS: optimal(80–100) | stable(50–79) | risky(25–49) | damaging(0–24)
hydrationLevel: water 95–100 | herbal tea 90 | sports drink 75 | juice 70 | milk 65 | coffee 40 | soda 30 | alcohol 15–20 | solid food 10–30 based on water content

━━━ STEP 6: IMPACT TEXTS — ZERO TOLERANCE FOR GENERIC TEXT ━━━
Every impact field MUST name the ACTUAL detected food/drink and its specific ingredients.
BAD: "Energy is estimated based on nutritional profile."
GOOD: "The ugali in this dish provides a slow-releasing starch energy primarily from its maize flour base, delivering a moderate glycaemic rise over 2–3 hours..."
Each field: minimum 3 sentences, minimum 60 words, hedged scientific language ("may", "research suggests", "appears to").`;

const ANALYSIS_USER_PROMPT = `Examine this image carefully.

STEP 1 — IDENTIFY: What specific food or drink is this? Use every visual clue: brand logos, label text, food colour/texture, cooking style, plating, container type.

STEP 2 — ESTIMATE SERVING: How large is the portion visible? (e.g. "full dinner plate ≈ 500g", "330ml can", "250ml glass")

STEP 3 — NUTRITION CALCULATION:
Before writing the JSON, mentally calculate:
• Identify each major component and its approximate weight
• Look up each component in USDA/regional DB
• Sum calories: must equal protein×4 + carbs×4 + fat×9 (within 5%)
• NEVER output zero for any macronutrient in real food (only water has 0 kcal)

Return ONLY this JSON object — no markdown, no extra text:

{
  "id": "scan_placeholder",
  "detectedProduct": "<REQUIRED — specific name. Examples: 'Coca-Cola Classic 330ml', 'Ugali with Nyama Choma and Sukuma Wiki', 'Grilled Chicken Caesar Salad', 'Banana', 'Pumpkin Stew with Rice', 'Chapati with Beef Stew'. NEVER 'Unknown Item'. If uncertain, use 'Possible [best guess]' or most specific category description.>",
  "brand": "<visible brand name, or null for fresh/homemade food>",
  "category": "<water|soda|energy_drink|tea|coffee|juice|alcohol|sports_drink|dairy|plant_milk|supplement|solid_food|mixed_meal|snack|condiment|other>",
  "liquidType": "<beverage|cooking_oil|condiment|alcohol|supplement|other>",
  "consumableType": "<beverage|solid_food|mixed_meal|snack|condiment|supplement — only use 'condiment' for actual condiments like ketchup/hot sauce/soy sauce, NEVER for meals, rice, stew, or vegetables>",
  "confidenceScore": 0.88,
  "impactScore": 68,
  "hydrationLevel": 45,
  "glycemicImpact": "<low|moderate|high|very_high>",
  "status": "<optimal|stable|risky|damaging>",
  "dehydrationRisk": false,
  "satietyScore": 72,
  "digestiveLoad": "<light|moderate|heavy>",
  "nutrientDensity": 65,
  "fiberEstimate": "<low|medium|high>",
  "proteinQuality": "<complete|incomplete|not_applicable>",
  "mealTimingFit": { "breakfast": "fair", "lunch": "excellent", "dinner": "good", "snack": "poor" },
  "bloodSugarTrajectory": "<spike|sustained|gradual|crash>",
  "componentBreakdown": [],
  "allergenFlags": ["<e.g. gluten, dairy, nuts — only list confirmed allergens>"],
  "processingLevel": "<whole|minimally_processed|processed|ultra_processed>",
  "mealType": "<breakfast|lunch|dinner|snack>",
  "hydrationScore": 45,
  "sugarLoadScore": 60,
  "caffeineScore": 95,
  "electrolyteScore": 40,
  "micronutrientScore": 58,
  "proteinQualityScore": 72,
  "fiberScore": 45,
  "healthyFatScore": 55,
  "aiInsight": "<REQUIRED — 3-4 sentences about THIS SPECIFIC item. Name the actual food/drink visible. Describe its nutritional profile, key strengths and concerns, and what the user should know. Example for ugali+nyama: 'This traditional East African plate combines ugali — a dense maize-flour starch — with nyama choma (roasted goat meat) and sukuma wiki (African kale), delivering a balanced macronutrient profile with high protein from the meat and vitamins A and C from the leafy greens...' Min 80 words. Zero tolerance for generic text.>",
  "viralStatement": "<8–12 word punchy health fact specific to this exact item>",
  "alternatives": ["<specific healthier swap for this item>", "<another specific alternative>"],
  "shortTermImpact": {
    "energyResponse": "<3–4 sentences on blood glucose curve in first 1–4 hours from THIS item's actual carbs/sugars. Name the specific carb sources. Describe insulin response, energy peak timing, and any crash risk. Min 60 words.>",
    "bloodSugarResponse": "<3–4 sentences on glycaemic trajectory. State approximate GI of the main carb source. Describe spike risk, absorption speed, and insulin demand. Reference the actual starches/sugars present. Min 60 words.>",
    "bodyReaction": "<3–4 sentences on immediate physiological reactions: digestive effort, gut motility, satiety signals, bloating risk, any inflammation from specific ingredients. Be specific to THIS food. Min 60 words.>",
    "hydrationImpact": "<3–4 sentences on net hydration effect: hydrating or diuretic, electrolytes provided/depleted, fluid balance effect. For solid food, describe water content. Min 60 words.>"
  },
  "mediumTermImpact": {
    "energyStability": "<3–4 sentences on energy pattern over 7–30 days of regular consumption. Adrenal impact, cortisol rhythm, mitochondrial effects from specific macros. Min 60 words.>",
    "physicalChanges": "<3–4 sentences on body composition from regular consumption: caloric density impact, water retention, muscle synthesis from protein content, skin effects. Min 60 words.>",
    "habitRisk": "<3–4 sentences on dependency risk: caffeine/sugar content, withdrawal effects, addictive consumption patterns specific to this item. Min 60 words.>",
    "sleepQuality": "<3–4 sentences on sleep impact: caffeine disruption, glycaemic nocturnal swings, ideal cutoff time for this specific item. Min 60 words.>"
  },
  "longTermImpact": {
    "healthTrend": "<3–4 sentences on 1–5 year health trajectory from regular consumption. Epidemiological evidence for this food category. Cardiovascular, inflammatory, longevity markers. Min 60 words.>",
    "metabolicImpact": "<3–4 sentences on metabolic consequences: insulin sensitivity, hepatic fat risk from fructose/fat content, lipid profile effects (LDL/HDL/triglycerides), visceral fat probability. Min 60 words.>",
    "riskAccumulation": "<3–4 sentences on chronic disease risk: cancer association for processing level, cardiovascular risk from fat/sodium, diabetes risk from sugar load, kidney/liver stress. Min 60 words.>",
    "nutritionalBalance": "<3–4 sentences on long-term nutritional contribution: micronutrient density, key vitamins/minerals provided or depleted, gut microbiome effects over months/years. Min 60 words.>"
  },
  "composition": {
    "calories": 420,
    "carbsGrams": 45,
    "sugarGrams": 8,
    "caffeineMg": 0,
    "sodiumMg": 420,
    "fatGrams": 16,
    "proteinGrams": 28,
    "fiberGrams": 4,
    "servingSize": 380,
    "servingUnit": "g",
    "artificialSweeteners": false,
    "additives": [],
    "ingredients": [
      {
        "name": "<actual ingredient visible or known to be in this product>",
        "function": "<physiological role in the body>",
        "healthRole": "<positive|neutral|concerning>",
        "riskLevel": "<low|medium|high>",
        "description": "<one sentence on what it is and its nutritional role>",
        "aiNote": "<specific actionable insight about this ingredient for the user>"
      }
    ]
  }
}

MANDATORY FINAL VERIFICATION before outputting:
✓ calories is NOT zero (unless item is plain water)
✓ protein, fat, carbs are realistic and sum to ≈ calories via the 4/4/9 rule
✓ aiInsight names the actual food/drink — zero generic text
✓ all 12 impact fields are >60 words each and reference THIS specific item
✓ consumableType is NOT 'condiment' unless item is literally a condiment
✓ servingSize matches what is visually present in the image
✓ impactScore, hydrationLevel, satietyScore are unique to this item — not copied from a template`;

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
