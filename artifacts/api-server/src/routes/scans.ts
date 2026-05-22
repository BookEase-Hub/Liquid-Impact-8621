import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, scansTable } from "@workspace/db";
import { verifyAccessToken } from "../middleware/authMiddleware";
import { analyzeWithIntelligentRouting } from "../services/ai-router";
import { analysisResponseSchema } from "../services/schema/analysis.schema";
import { logger } from "../lib/logger";

const router = Router();

// ─── Improved System Prompt ───────────────────────────────────────────────────
const ANALYSIS_SYSTEM_PROMPT = `You are an expert liquid analyst and nutritionist. You ONLY analyse what is visually observable in the image — you NEVER fabricate brand names, ingredients, or nutritional data you cannot see or reasonably infer.

REASONING PROTOCOL — follow these stages silently before writing the JSON:

STAGE 1 — VISUAL CLASSIFICATION:
Observe carefully:
• Container type: can / glass bottle / plastic bottle / cup / bowl / tetra pak / unknown
• Liquid visibility: fully visible / partially visible / container opaque
• Liquid colour: clear / golden / amber / dark brown / white / green / pink / red / unknown
• Carbonation signs: bubbles / flat
• Viscosity: thin (water-like) / medium (juice-like) / thick (smoothie/oil-like)
• Foam: present / absent
• Ice: present / absent
• Label text: readable (what does it say?) / partially readable / not visible
• Brand logo: identified / unidentified
• Container shape clues: beer bottle shape / wine bottle / spirit bottle / soda can / water bottle / juice carton / oil bottle (tall slender) / condiment bottle

STAGE 2 — REASONING:
Given your Stage 1 observations:
• What is the MOST LIKELY beverage/liquid based on ALL visual clues combined?
• Is this definitely a beverage, or could it be a cooking oil / condiment / supplement?
• What is your confidence? HIGH (>85%) / MEDIUM (60-85%) / LOW (<60%)
• If confidence is LOW, what alternative identifications are possible?

CRITICAL ALCOHOL DETECTION RULES:
• Clear liquid in a spirit/vodka bottle shape → likely spirit/vodka, NOT water
• Amber liquid in a short wide-mouthed glass → likely whiskey/bourbon  
• Dark brown carbonated liquid in a can/glass → likely cola or beer
• Golden carbonated liquid in a tall glass → likely beer or cider
• Slim cylindrical cans with energy drink design → likely energy drink
• If you see ANY alcohol brand name (even partially) → classify as alcohol
• When uncertain between water and clear spirit → err toward spirit if bottle shape is non-standard

COOKING OIL RULES:
• Tall slender bottles with golden/pale yellow liquid → cooking_oil
• Never misidentify olive oil / vegetable oil as juice or tea

LOW CONFIDENCE BEHAVIOUR (confidence < 60%):
• In aiInsight: say "This appears to be…" or "Based on visible characteristics, this may be…"
• Do NOT fabricate specific brand names
• Do NOT invent precise nutritional values — use wide ranges instead
• Set viralStatement to an honest, non-specific observation
• Reduce impactScore confidence range by widening composition estimates

IMPORTANT — ALL output is for general wellness and educational purposes only, not medical advice.

Return ONLY a valid JSON object. No markdown, no commentary, no preamble.`;

const ANALYSIS_USER_PROMPT = `Analyse this image using the reasoning protocol and return EXACTLY this JSON structure. No extra text.

Rules:
- "id": generate "scan_" + 8 random alphanumeric chars
- "detectedProduct": be specific if confident, vague if not (e.g. "Unidentified Clear Spirit" not "Water")
- "brand": exact brand name if VISIBLE AND READABLE, otherwise null
- "confidenceScore": your honest confidence 0.0–1.0 based on Stage 2 reasoning
- "impactScore": integer 0–100 per scoring guidelines below
- "status": optimal(80-100) / stable(50-79) / risky(25-49) / damaging(0-24)
- Use "may", "appears to", "estimated" language in all impact fields

Scoring guidelines:
Water: 92-100 | Herbal tea: 85-95 | Green/black tea: 78-90 | Black coffee: 70-82
Fresh juice (no added sugar): 68-80 | Milk/oat milk: 58-72 | Coconut water: 75-88
Sports drinks: 42-62 | Packaged juice (added sugar): 38-62
Soda/cola: 12-32 | Energy drinks: 8-28 | Alcohol: 5-22 | Spirits: 3-15

{
  "id": "scan_<8chars>",
  "detectedProduct": "<specific name if confident, or 'Possible [type]' if uncertain>",
  "brand": "<brand if clearly visible, else null>",
  "category": "<water|juice|soda|coffee|tea|energy|alcohol|spirits|beer|wine|milk|smoothie|sport|olive_oil|vegetable_oil|vinegar|hot_sauce|syrup|supplement|other>",
  "liquidType": "<beverage|cooking_oil|condiment|alcohol|supplement|other>",
  "confidenceScore": <0.0-1.0>,
  "impactScore": <0-100>,
  "hydrationLevel": <0-100; spirits/alcohol: 5-20, energy drinks: 20-35, water: 95-100>,
  "glycemicImpact": "<low|moderate|high|very_high>",
  "status": "<optimal|stable|risky|damaging>",
  "dehydrationRisk": <true for: alcohol, very high caffeine, high sugar; false otherwise>,
  "aiInsight": "<3-4 sentence educational wellness insight. If low confidence: start with 'This appears to be…'. If cooking oil: state it is NOT a drink. Use non-clinical language.>",
  "viralStatement": "<punchy 10-word wellness statement; if uncertain say 'Results based on visual analysis only'>",
  "tiktokHook": "<Short hook for TikTok/Reels>",
  "alternatives": ["<healthier alternative 1>", "<healthier alternative 2>"],
  "shortTermImpact": {
    "energyResponse": "<estimated energy effect in 1-2h — use 'may' language>",
    "bloodSugarResponse": "<blood sugar indicator — use 'may' or 'estimated'>",
    "bodyReaction": "<general physiological response estimate>",
    "hydrationImpact": "<hydration effect estimate>"
  },
  "mediumTermImpact": {
    "energyStability": "<estimated energy pattern with regular use>",
    "physicalChanges": "<potential physical indicators over weeks>",
    "habitRisk": "<habit-formation consideration>",
    "sleepQuality": "<potential sleep effect — use 'may' language>"
  },
  "longTermImpact": {
    "healthTrend": "<general wellness trajectory — use 'may' or 'potential'>",
    "metabolicImpact": "<potential metabolic consideration>",
    "riskAccumulation": "<general wellness consideration with long-term use>",
    "nutritionalBalance": "<nutritional contribution or potential deficit>"
  },
  "composition": {
    "calories": <per serving; estimate range midpoint if uncertain>,
    "sugarGrams": <estimate; 0 if water/plain spirits>,
    "caffeineMg": <estimate; 0 if non-caffeinated>,
    "sodiumMg": <estimate>,
    "fatGrams": <estimate; high for oils>,
    "proteinGrams": <estimate>,
    "servingSize": <typical serving number>,
    "servingUnit": "<ml|g|oz|tbsp|cup>",
    "artificialSweeteners": <true|false>,
    "additives": ["<additive if known, skip if uncertain>"],
    "ingredients": [
      {
        "name": "<ingredient — only include if reasonably confident it is present>",
        "function": "<biological role>",
        "healthRole": "<positive|neutral|concerning|quick-energy|alertness|zero-calorie|antioxidant|metabolic-support|energy-metabolism|liver-support|energy|immune-support|rehydration|bone-support|muscle-support|traditional|hydration|flavor|metabolism-support|energy-support|gut-health>",
        "riskLevel": "<low|medium|high|moderate>",
        "description": "<one educational sentence>",
        "aiNote": "<specific wellness note>"
      }
    ]
  }
}`;

// ─── Analyze endpoint ─────────────────────────────────────────────────────────
router.post("/scans/analyze", async (req, res) => {
  try {
    const imageBase64 = req.body?.imageBase64;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    const requestId = `scan_req_${Date.now()}`;

    const result = await analyzeWithIntelligentRouting({
      imageBase64,
      systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      userPrompt: ANALYSIS_USER_PROMPT,
      schema: analysisResponseSchema,
      requestId,
      userId: (req as any).user?.id
    });

    res.json(result.response);
  } catch (err: any) {
    logger.error({ err }, "Failed to analyze scan");
    res.status(err.status || 500).json({ error: err.message || "Failed to analyze drink image" });
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
    const scan = req.body as any;
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
        confidenceScore: (scan.confidenceScore as number) ?? 0.7,
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
        scannedAt: scan.scannedAt ? new Date(scan.scannedAt as number) : new Date(),
      })
      .onConflictDoNothing();

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
    logger.error({ err }, "Failed to fetch scans");
    return res.status(500).json({ error: "Failed to fetch scans" });
  }
});

export default router;
