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
const ANALYSIS_SYSTEM_PROMPT = `You are an expert food and beverage analyst specialising in nutrition and health impact.
You analyse images of food, drinks, and meals to provide comprehensive nutritional and health insights.
Your response must always be a single valid JSON object — no markdown, no preamble, no extra text.

CLASSIFICATION (choose one consumableType):
• beverage — water, juice, soda, coffee, tea, alcohol, milk, energy drink, smoothie
• solid_food — apple, sandwich, steak, salad, rice, bread, etc.
• mixed_meal — a plate/bowl with multiple distinct food components
• snack — protein bar, chips, cookies, nuts, etc.
• condiment — ketchup, hot sauce, sauces used in small amounts
• supplement — vitamins, protein powder, pills

IMPACT SCORES (0–100, higher = healthier):
Beverages: water 95 | herbal tea 88 | green tea 82 | black coffee 74 | fresh juice 72 | oat milk 65
  sports drink 50 | packaged juice 48 | soda 22 | energy drink 18 | beer 20 | spirits 12
Foods: leafy greens/raw veg 90 | whole fruit 88 | legumes 82 | whole grains 75 | lean protein 78
  eggs 72 | dairy 65 | processed snack 38 | fast food burger 28 | fried food 30 | candy 15

STATUS: optimal(80–100) | stable(50–79) | risky(25–49) | damaging(0–24)
PROCESSING: whole → minimally_processed → processed → ultra_processed`;

const ANALYSIS_USER_PROMPT = `Analyse this image and return EXACTLY the following JSON structure. 
Return only valid JSON — no markdown code blocks, no extra text before or after.

{
  "id": "scan_XXXXXXXX",
  "detectedProduct": "<specific name, or 'Possible X' if low confidence>",
  "brand": "<visible brand name or null>",
  "category": "<one of: water|soda|energy_drink|tea|coffee|juice|alcohol|sports_drink|dairy|plant_milk|supplement|cooking_oil|solid_food|mixed_meal|snack|condiment|other>",
  "liquidType": "<beverage|cooking_oil|condiment|alcohol|supplement|other>",
  "consumableType": "<beverage|solid_food|mixed_meal|snack|condiment|supplement>",
  "confidenceScore": 0.85,
  "impactScore": 50,
  "hydrationLevel": 50,
  "glycemicImpact": "<low|moderate|high|very_high>",
  "status": "<optimal|stable|risky|damaging>",
  "dehydrationRisk": false,
  "satietyScore": null,
  "digestiveLoad": "<light|moderate|heavy>",
  "nutrientDensity": 50,
  "fiberEstimate": "<low|medium|high>",
  "proteinQuality": "<complete|incomplete|not_applicable>",
  "mealTimingFit": {
    "breakfast": "<excellent|good|fair|poor>",
    "lunch": "<excellent|good|fair|poor>",
    "dinner": "<excellent|good|fair|poor>",
    "snack": "<excellent|good|fair|poor>"
  },
  "bloodSugarTrajectory": "<spike|sustained|gradual|crash>",
  "componentBreakdown": [],
  "allergenFlags": [],
  "processingLevel": "<whole|minimally_processed|processed|ultra_processed>",
  "mealType": "<breakfast|lunch|dinner|snack>",
  "aiInsight": "<2-3 sentence educational wellness insight using 'may', 'estimated', 'appears to'>",
  "viralStatement": "<punchy 10-word health take>",
  "alternatives": ["<healthier alternative 1>", "<healthier alternative 2>"],
  "shortTermImpact": {
    "energyResponse": "<estimated energy effect in 1–2h>",
    "bloodSugarResponse": "<blood sugar indicator>",
    "bodyReaction": "<general physiological response>",
    "hydrationImpact": "<hydration effect>"
  },
  "mediumTermImpact": {
    "energyStability": "<estimated energy pattern over weeks>",
    "physicalChanges": "<potential physical indicators>",
    "habitRisk": "<habit-formation consideration>",
    "sleepQuality": "<potential sleep effect>"
  },
  "longTermImpact": {
    "healthTrend": "<general wellness trajectory>",
    "metabolicImpact": "<potential metabolic consideration>",
    "riskAccumulation": "<general wellness consideration>",
    "nutritionalBalance": "<nutritional contribution>"
  },
  "composition": {
    "calories": 0,
    "sugarGrams": 0,
    "caffeineMg": 0,
    "sodiumMg": 0,
    "fatGrams": 0,
    "proteinGrams": 0,
    "fiberGrams": 0,
    "servingSize": 100,
    "servingUnit": "<ml|g|oz|cup|piece|bowl>",
    "artificialSweeteners": false,
    "additives": [],
    "ingredients": [
      {
        "name": "<ingredient name>",
        "function": "<biological role>",
        "healthRole": "<positive|neutral|concerning>",
        "riskLevel": "<low|medium|high>",
        "description": "<one educational sentence>",
        "aiNote": "<specific wellness note>"
      }
    ]
  }
}

Fill ALL fields based on what you see. Use realistic estimates from nutritional databases.
For mixed_meal: populate componentBreakdown with each visible component.
For beverages: set satietyScore to null.
Never leave required string fields empty — use "Unknown" as last resort.`;

// ─── Robust JSON extraction + defaults ────────────────────────────────────────
function extractAndNormalize(raw: string): Record<string, unknown> {
  // Strip markdown code fences if present
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // Extract first complete JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in AI response");

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(match[0]);
  } catch {
    // Try to repair common trailing-comma issues
    const repaired = match[0].replace(/,\s*([}\]])/g, "$1");
    data = JSON.parse(repaired);
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
    if (typeof c.calories !== "number") c.calories = 0;
    if (typeof c.sugarGrams !== "number") c.sugarGrams = 0;
    if (typeof c.caffeineMg !== "number") c.caffeineMg = 0;
    if (typeof c.sodiumMg !== "number") c.sodiumMg = 0;
    if (typeof c.fatGrams !== "number") c.fatGrams = 0;
    if (typeof c.proteinGrams !== "number") c.proteinGrams = 0;
    if (typeof c.fiberGrams !== "number") c.fiberGrams = 0;
    if (typeof c.servingSize !== "number") c.servingSize = 100;
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

// ─── Direct AI call — no response_format wrapper, extract JSON from text ────────
async function callAIVision(imageBase64: string): Promise<Record<string, unknown>> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 55_000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o",
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" },
              },
              { type: "text", text: ANALYSIS_USER_PROMPT },
            ],
          },
        ],
        max_tokens: 3000,
        temperature: 0.1,
        // No response_format here — we extract JSON ourselves via regex
        // This avoids the "messages must contain 'json'" 400 error from OpenAI
      },
      { signal: abortController.signal as AbortSignal },
    );
    return extractAndNormalize(completion.choices[0]?.message?.content ?? "");
  } finally {
    clearTimeout(timeoutId);
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
