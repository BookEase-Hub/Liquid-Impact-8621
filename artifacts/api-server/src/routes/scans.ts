import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, scansTable } from "@workspace/db";
import { verifyAccessToken } from "../middleware/authMiddleware";

const router = Router();

const ANALYSIS_SYSTEM_PROMPT = `You are an expert nutritionist, food scientist, and liquid analyst with 20+ years of experience. Your job is to accurately analyze ANY liquid shown in an image — beverages, cooking oils, condiments, or other liquids.

CRITICAL IDENTIFICATION RULES:
- OLIVE OIL / COOKING OILS (vegetable, canola, sunflower, coconut, palm, sesame, etc.) → liquidType: "cooking_oil". NEVER misidentify oil as tea, juice, or herbal drink. Oil bottles are typically tall, slender, with golden/yellow liquid.
- VINEGAR, SOY SAUCE, HOT SAUCE, SYRUPS → liquidType: "condiment"
- WINE, BEER, SPIRITS, HARD CIDER → liquidType: "alcohol"
- PROTEIN SHAKES, VITAMINS, SUPPLEMENTS → liquidType: "supplement"
- WATER, SODA, JUICE, COFFEE, TEA, ENERGY DRINKS, MILK, SMOOTHIES → liquidType: "beverage"

LOOK CAREFULLY AT:
1. The container shape and type (oil bottle vs soda can vs water bottle vs wine glass)
2. The liquid color and viscosity (oil is thick/golden, water is clear, coffee is dark)
3. Any visible label text, brand logo, or nutritional info
4. The overall packaging design and color scheme

SCORING GUIDELINES:
- Water: 95-100 | Herbal tea: 85-95 | Green/black tea: 80-90 | Black coffee: 72-82
- Fresh juice (no sugar): 70-85 | Milk: 60-75 | Coconut water: 78-88
- Sports drinks: 45-65 | Fruit juice with added sugar: 40-65
- Soda/soft drinks: 15-35 | Energy drinks: 10-30
- Alcohol: 5-25 | Cooking oils (if somehow consumed): 10-20
- Condiments: 20-40 (used in small amounts)

STATUS: optimal(80-100), stable(50-79), risky(25-49), damaging(0-24)

IMPORTANT — ALL results are for general wellness and educational purposes only, not medical advice.

Return ONLY a valid JSON object — no markdown, no explanation, just JSON.`;

const ANALYSIS_USER_PROMPT = `Analyze this liquid image carefully and return this exact JSON structure:

{
  "id": "scan_<random_8_alphanumeric>",
  "detectedProduct": "<specific product name, e.g. 'Extra Virgin Olive Oil' NOT just 'oil'>",
  "brand": "<brand name or null if not visible>",
  "category": "<specific category: water/juice/soda/coffee/tea/energy/alcohol/milk/smoothie/sport/olive_oil/vegetable_oil/vinegar/hot_sauce/syrup/supplement/other>",
  "liquidType": "<beverage|cooking_oil|condiment|alcohol|supplement|other>",
  "confidenceScore": <0.0-1.0, your confidence in the identification>,
  "impactScore": <integer 0-100>,
  "hydrationLevel": <integer 0-100, cooking oils get 0-5, alcohols get 10-30>,
  "glycemicImpact": "<low|moderate|high|very_high>",
  "status": "<optimal|stable|risky|damaging>",
  "dehydrationRisk": <true if drink causes dehydration (alcohol, very high caffeine), false otherwise>,
  "aiInsight": "<3-4 sentence evidence-based wellness insight. If cooking oil: explicitly state this is NOT a beverage and explain its fat profile. Be specific to the detected product. Use educational, non-medical language.>",
  "viralStatement": "<one punchy wellness statement about this liquid's body impact, max 12 words>",
  "alternatives": ["<healthier alternative 1>", "<healthier alternative 2>"],
  "shortTermImpact": {
    "energyResponse": "<energy effect estimate within 1-2 hours of consumption>",
    "bloodSugarResponse": "<blood glucose indicator in 30-60 minutes — use 'may' or 'estimated'>",
    "bodyReaction": "<general physiological response indicator>",
    "hydrationImpact": "<estimated cellular hydration effect>"
  },
  "mediumTermImpact": {
    "energyStability": "<estimated energy pattern over 1-4 weeks of regular use>",
    "physicalChanges": "<potential physical indicators over weeks>",
    "habitRisk": "<potential dependency or habit-formation consideration>",
    "sleepQuality": "<potential effect on sleep — use 'may' language>"
  },
  "longTermImpact": {
    "healthTrend": "<general wellness trajectory with regular use — use 'may' or 'potential'>",
    "metabolicImpact": "<potential effect on metabolism and body composition>",
    "riskAccumulation": "<general wellness considerations with long-term use>",
    "nutritionalBalance": "<nutritional contribution or potential deficit>"
  },
  "composition": {
    "calories": <integer, per typical serving>,
    "sugarGrams": <number>,
    "caffeineMg": <number>,
    "sodiumMg": <number>,
    "fatGrams": <number, high for oils>,
    "proteinGrams": <number>,
    "servingSize": <number>,
    "servingUnit": "<ml|g|oz|tbsp|cup>",
    "artificialSweeteners": <true|false>,
    "additives": ["<additive1>", "<additive2>"],
    "ingredients": [
      {
        "name": "<ingredient name>",
        "function": "<biological role in the body>",
        "healthRole": "<positive|neutral|concerning>",
        "riskLevel": "<low|medium|high>",
        "description": "<one sentence about this ingredient>",
        "aiNote": "<specific wellness note about this ingredient>"
      }
    ]
  }
}`;

router.post("/scans/analyze", async (req, res) => {
  try {
    const imageBase64 = req.body?.imageBase64;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    const completion = await openai.chat.completions.create({
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
      max_tokens: 2500,
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.error({ content }, "No JSON found in OpenAI response");
      res.status(500).json({ error: "Failed to parse AI analysis" });
      return;
    }

    const result = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (!result.id || typeof result.id !== "string") {
      result.id = `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    }
    if (!result.liquidType) result.liquidType = "beverage";
    if (!result.confidenceScore) result.confidenceScore = 0.85;
    if (!result.dehydrationRisk) result.dehydrationRisk = false;
    if (!result.alternatives) result.alternatives = [];

    const comp = result.composition as Record<string, unknown> | undefined;
    if (comp) {
      if (!comp.sodiumMg) comp.sodiumMg = 0;
      if (!comp.fatGrams) comp.fatGrams = 0;
      if (!comp.proteinGrams) comp.proteinGrams = 0;
      if (!comp.servingSize) comp.servingSize = 240;
      if (!comp.servingUnit) comp.servingUnit = "ml";
      if (comp.artificialSweeteners === undefined) comp.artificialSweeteners = false;
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to analyze scan");
    res.status(500).json({ error: "Failed to analyze drink image" });
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

    await db
      .insert(scansTable)
      .values({
        id: scan.id as string,
        userId,
        detectedProduct: (scan.detectedProduct as string) ?? "Unknown",
        brand: (scan.brand as string | null) ?? null,
        category: (scan.category as string) ?? "other",
        liquidType: (scan.liquidType as string) ?? "beverage",
        confidenceScore: (scan.confidenceScore as number) ?? 0.85,
        impactScore: (scan.impactScore as number) ?? 0,
        hydrationLevel: (scan.hydrationLevel as number) ?? 0,
        glycemicImpact: (scan.glycemicImpact as string) ?? "low",
        status: (scan.status as string) ?? "stable",
        dehydrationRisk: (scan.dehydrationRisk as boolean) ?? false,
        aiInsight: (scan.aiInsight as string) ?? "",
        viralStatement: (scan.viralStatement as string | null) ?? null,
        alternatives: (scan.alternatives as string[]) ?? [],
        shortTermImpact: scan.shortTermImpact as object,
        mediumTermImpact: scan.mediumTermImpact as object,
        longTermImpact: scan.longTermImpact as object,
        composition: scan.composition as object,
        scannedAt: scan.scannedAt
          ? new Date(scan.scannedAt as number)
          : new Date(),
      })
      .onConflictDoNothing();

    req.log.info({ userId, scanId: scan.id }, "Scan saved to cloud");
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save scan");
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
    const rows = await db
      .select()
      .from(scansTable)
      .where(eq(scansTable.userId, userId))
      .orderBy(desc(scansTable.scannedAt))
      .limit(200);

    const scans = rows.map((r) => ({
      id: r.id,
      detectedProduct: r.detectedProduct,
      brand: r.brand,
      category: r.category,
      liquidType: r.liquidType,
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
    }));

    return res.json({ scans });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch scans");
    return res.status(500).json({ error: "Failed to fetch scans" });
  }
});

export default router;
