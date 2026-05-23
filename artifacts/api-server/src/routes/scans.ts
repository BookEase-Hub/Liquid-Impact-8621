import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, scansTable } from "@workspace/db";
import { verifyAccessToken } from "../middleware/authMiddleware";
import { analyzeWithIntelligentRouting } from "../services/ai-router";
import { analysisResponseSchema } from "../services/schema/analysis.schema";
import { logger } from "../lib/logger";
import { lookupBeverageByKeywords } from "../services/beverage-cache";

const router = Router();

// ─── Optimized System Prompt (shorter = faster LLM response) ─────────────────
const ANALYSIS_SYSTEM_PROMPT = `You are an expert liquid analyst. Analyse ONLY what is visually observable. Never fabricate brand names or nutritional data you cannot see.

VISUAL CLASSIFICATION:
• Container type, liquid colour, carbonation, foam, ice, label text, brand logo
• Alcohol detection: clear liquid in spirit-shaped bottle → likely spirit; dark carbonated can → cola/beer; slim energy can → energy drink
• Oil detection: tall slender bottle with golden liquid → cooking_oil (not a beverage)

CONFIDENCE: HIGH (>85%) / MEDIUM (60-85%) / LOW (<60%)
If LOW: use "appears to be", "estimated", never fabricate brand names.

Return ONLY valid JSON. No markdown, no extra text.`;

const ANALYSIS_USER_PROMPT = `Analyse this image and return EXACTLY this JSON. No extra text.

Rules:
- "id": "scan_" + 8 random alphanumeric chars
- "detectedProduct": specific if confident, vague if not
- "brand": exact brand if VISIBLE AND READABLE, else null
- "confidenceScore": 0.0–1.0
- "impactScore": 0–100 (Water:92-100 | Tea:78-90 | Coffee:70-82 | Juice:55-75 | Sports:42-62 | Soda:12-32 | Energy:8-28 | Alcohol:5-22)
- "status": optimal(80-100) / stable(50-79) / risky(25-49) / damaging(0-24)

{
  "id": "scan_<8chars>",
  "detectedProduct": "<name>",
  "brand": "<brand or null>",
  "category": "<water|juice|soda|coffee|tea|energy|alcohol|spirits|beer|wine|milk|smoothie|sport|other>",
  "liquidType": "<beverage|cooking_oil|condiment|alcohol|supplement|other>",
  "confidenceScore": <0.0-1.0>,
  "impactScore": <0-100>,
  "hydrationLevel": <0-100>,
  "glycemicImpact": "<low|moderate|high|very_high>",
  "status": "<optimal|stable|risky|damaging>",
  "dehydrationRisk": <true|false>,
  "aiInsight": "<3-4 sentence wellness insight>",
  "viralStatement": "<punchy 10-word wellness statement>",
  "tiktokHook": "<short hook>",
  "alternatives": ["<alt 1>", "<alt 2>"],
  "shortTermImpact": {
    "energyResponse": "<energy effect>",
    "bloodSugarResponse": "<blood sugar indicator>",
    "bodyReaction": "<physiological response>",
    "hydrationImpact": "<hydration effect>"
  },
  "mediumTermImpact": {
    "energyStability": "<energy pattern>",
    "physicalChanges": "<physical indicators>",
    "habitRisk": "<habit consideration>",
    "sleepQuality": "<sleep effect>"
  },
  "longTermImpact": {
    "healthTrend": "<wellness trajectory>",
    "metabolicImpact": "<metabolic consideration>",
    "riskAccumulation": "<long-term risk>",
    "nutritionalBalance": "<nutritional contribution>"
  },
  "composition": {
    "calories": <number>,
    "sugarGrams": <number>,
    "caffeineMg": <number>,
    "sodiumMg": <number>,
    "fatGrams": <number>,
    "proteinGrams": <number>,
    "servingSize": <number>,
    "servingUnit": "<ml|g|oz>",
    "artificialSweeteners": <true|false>,
    "additives": [],
    "ingredients": [
      {
        "name": "<ingredient>",
        "function": "<role>",
        "healthRole": "<positive|neutral|concerning|alertness|energy|hydration|antioxidant>",
        "riskLevel": "<low|medium|high>",
        "description": "<one sentence>",
        "aiNote": "<wellness note>"
      }
    ]
  }
}`;

// ─── Analyze endpoint ─────────────────────────────────────────────────────────
router.post("/scans/analyze", async (req, res) => {
  try {
    const { imageBase64, ocrText, productHint } = req.body as {
      imageBase64?: string;
      ocrText?: string;
      productHint?: string;
    };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    // ── Layer 0: Server-side beverage cache (instant, 0ms) ──────────────────
    const searchText = [productHint, ocrText].filter(Boolean).join(" ").trim();
    if (searchText.length > 2) {
      const cached = lookupBeverageByKeywords(searchText);
      if (cached) {
        logger.info({ productHint, ocrText }, "Cache HIT — returning instant result");
        res.json(cached);
        return;
      }
    }

    // ── Layer 1: AI Vision (Gemini → OpenAI fallback) ───────────────────────
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
