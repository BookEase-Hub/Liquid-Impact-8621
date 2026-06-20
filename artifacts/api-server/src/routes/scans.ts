import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, scansTable } from "@workspace/db";
import { verifyAccessToken } from "../middleware/authMiddleware";
import { analyzeWithIntelligentRouting } from "../services/ai-router";
import { analysisResponseSchema } from "../services/schema/analysis.schema";
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

// ─── Optimized System Prompt ──────────────────────────────────────────────────
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
  "category": "<water|juice|soda|coffee|tea|energy_drink|alcohol|spirits|beer|wine|milk|smoothie|sport|other>",
  "liquidType": "<beverage|cooking_oil|condiment|alcohol|supplement|other>",
  "confidenceScore": <0.0-1.0>,
  "impactScore": <0-100>,
  "hydrationLevel": <0-100>,
  "glycemicImpact": "<low|moderate|high|very_high>",
  "status": "<optimal|stable|risky|damaging>",
  "dehydrationRisk": <true|false>,
  "aiInsight": "<2-3 sentence wellness insight>",
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

// ─── 3-Layer Analyze Endpoint ─────────────────────────────────────────────────
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

    // ══════════════════════════════════════════════════════════════════════════
    // LAYER 0 — In-memory cache (fastest: <1ms, zero cost)
    // ══════════════════════════════════════════════════════════════════════════

    const memHit = getCachedByImageHash(imageHash);
    if (memHit) {
      logger.info({ ms: Date.now() - t0 }, "L0 HIT: image hash (memory cache)");
      res.json(memHit);
      return;
    }

    if (barcode) {
      const barcodeMemHit = getCachedByBarcode(barcode);
      if (barcodeMemHit) {
        logger.info({ barcode, ms: Date.now() - t0 }, "L0 HIT: barcode (memory cache)");
        res.json(barcodeMemHit);
        return;
      }
    }

    if (searchText.length > 2) {
      const fingerprintHit = getCachedByFingerprint(buildFingerprint(searchText));
      if (fingerprintHit) {
        logger.info({ searchText, ms: Date.now() - t0 }, "L0 HIT: name fingerprint (memory cache)");
        res.json(fingerprintHit);
        return;
      }

      // Keyword beverage cache (150+ common drinks, instant)
      const keywordHit = lookupBeverageByKeywords(searchText);
      if (keywordHit) {
        logger.info({ searchText, ms: Date.now() - t0 }, "L0 HIT: keyword beverage cache");
        res.json(keywordHit);
        return;
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LAYER 1 — PostgreSQL product intelligence DB (fast: 5-20ms, zero AI cost)
    // ══════════════════════════════════════════════════════════════════════════

    const dbImageHit = await dbLookupByImageHash(imageHash);
    if (dbImageHit) {
      logger.info({ ms: Date.now() - t0 }, "L1 HIT: image hash (products DB)");
      res.json(dbImageHit);
      return;
    }

    if (barcode) {
      const dbBarcodeHit = await dbLookupByBarcode(barcode);
      if (dbBarcodeHit) {
        logger.info({ barcode, ms: Date.now() - t0 }, "L1 HIT: barcode (products DB)");
        res.json(dbBarcodeHit);
        return;
      }
    }

    if (searchText.length > 2) {
      const dbFingerprintHit = await dbLookupByFingerprint(buildFingerprint(searchText));
      if (dbFingerprintHit) {
        logger.info({ searchText, ms: Date.now() - t0 }, "L1 HIT: fingerprint (products DB)");
        res.json(dbFingerprintHit);
        return;
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LAYER 2 — Open Food Facts (medium: 200-800ms, zero AI cost)
    // Barcode lookups → exact match; name search → fuzzy match
    // ══════════════════════════════════════════════════════════════════════════

    if (barcode) {
      const offResult = await offLookupByBarcode(barcode);
      if (offResult) {
        logger.info({ barcode, ms: Date.now() - t0 }, "L2 HIT: Open Food Facts barcode");
        await saveProduct(offResult, { imageHash, barcode, source: "openfoodfacts" });
        res.json(offResult);
        return;
      }
    }

    if (searchText.length > 3) {
      const offNameResult = await offSearchByName(searchText);
      if (offNameResult) {
        logger.info({ searchText, ms: Date.now() - t0 }, "L2 HIT: Open Food Facts name search");
        await saveProduct(offNameResult, { imageHash, source: "openfoodfacts" });
        res.json(offNameResult);
        return;
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LAYER 3 — AI Vision (slowest: 3-15s, costs money — only used when needed)
    // ══════════════════════════════════════════════════════════════════════════

    const requestId = `scan_req_${Date.now()}`;
    logger.info({ requestId, hasBarcode: !!barcode, searchText }, "L3: calling AI (no cache hit)");

    const aiResult = await analyzeWithIntelligentRouting({
      imageBase64,
      systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      userPrompt: ANALYSIS_USER_PROMPT,
      schema: analysisResponseSchema,
      requestId,
      userId: (req as any).user?.id,
    });

    // Persist result — future identical scans will hit L0/L1 instead of AI
    await saveProduct(aiResult.response, {
      imageHash,
      barcode: barcode ?? undefined,
      source: "ai",
    });

    logger.info({
      provider: aiResult.provider,
      ms: Date.now() - t0,
      product: aiResult.response.detectedProduct,
    }, "L3 MISS → AI result saved to product DB");

    res.json(aiResult.response);
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
