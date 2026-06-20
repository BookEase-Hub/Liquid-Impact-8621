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

// ─── Optimized prompts — short = fast (schema enforces output structure) ───────
// Gemini's responseSchema already constrains output fields/types, so we only need
// ANALYSIS GUIDANCE here, not a full JSON template. ~80% fewer prompt tokens.
const SYSTEM_PROMPT = `Expert beverage health analyst. Analyze only what is visually observable.
IDENTIFY: Container type, color, carbonation, label text, brand logo.
BRAND: Include ONLY if text is clearly readable on label. Otherwise null.
CONFIDENCE < 0.7: Prefix detectedProduct with "Possible ".
NON-BEVERAGE: Cooking oil or condiment → liquidType="cooking_oil", category="cooking_oil".
ALCOHOL: Clear liquid in spirit bottle=spirits | dark carbonated can=cola or beer | slim energy can=energy_drink.
IMPACT SCALE: water=95+ | tea=85 | coffee=72 | juice=62 | sports=52 | soda=25 | energy=18 | alcohol=15
STATUS: optimal(80-100) | stable(50-79) | risky(25-49) | damaging(0-24)
ACCURACY: Never fabricate nutrition values. Use visible label data. Use typical values for well-known brands.`;

const USER_PROMPT = `Analyze this drink image. Return factual health impact data based on visual identification only.`;

// ─── 3-Layer Intelligence Analyze Endpoint ───────────────────────────────────
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

    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 0 — In-memory LRU cache (<1ms, zero cost)
    // ═══════════════════════════════════════════════════════════════════════
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

      // 150+ common drinks — instant keyword match
      const keywordHit = lookupBeverageByKeywords(searchText);
      if (keywordHit) {
        logger.info({ ms: Date.now() - t0 }, "L0 HIT: keyword beverage cache");
        res.json(keywordHit);
        return;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 1 — PostgreSQL product DB (all lookups in parallel, 5–20ms)
    // ═══════════════════════════════════════════════════════════════════════
    const fingerprint = searchText.length > 2 ? buildFingerprint(searchText) : "";

    const [dbImageHit, dbBarcodeHit, dbFingerprintHit] = await Promise.all([
      dbLookupByImageHash(imageHash),
      barcode ? dbLookupByBarcode(barcode) : Promise.resolve(null),
      fingerprint ? dbLookupByFingerprint(fingerprint) : Promise.resolve(null),
    ]);

    const l1Hit = dbImageHit || dbBarcodeHit || dbFingerprintHit;
    if (l1Hit) {
      logger.info({ source: dbImageHit ? "imageHash" : dbBarcodeHit ? "barcode" : "fingerprint", ms: Date.now() - t0 }, "L1 HIT: products DB");
      res.json(l1Hit);
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 2 — Open Food Facts (barcode + name search in parallel, 200–800ms)
    // Only runs if L0 + L1 miss — free API, no AI cost
    // ═══════════════════════════════════════════════════════════════════════
    const [offBarcodeHit, offNameHit] = await Promise.all([
      barcode ? offLookupByBarcode(barcode) : Promise.resolve(null),
      searchText.length > 3 && !barcode ? offSearchByName(searchText) : Promise.resolve(null),
    ]);

    const l2Hit = offBarcodeHit || offNameHit;
    if (l2Hit) {
      logger.info({ hasBarcode: !!offBarcodeHit, ms: Date.now() - t0 }, "L2 HIT: Open Food Facts");
      await saveProduct(l2Hit, { imageHash, barcode: barcode ?? undefined, source: "openfoodfacts" });
      res.json(l2Hit);
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LAYER 3 — AI Vision: Gemini 2.0 Flash → OpenAI fallback
    // Only runs for unknown products. Short prompts → fast response (3–5s).
    // ═══════════════════════════════════════════════════════════════════════
    const requestId = `scan_req_${Date.now()}`;
    logger.info({ requestId, barcode, searchText: searchText.slice(0, 40) }, "L3: AI call (all layers missed)");

    const aiResult = await analyzeWithIntelligentRouting({
      imageBase64,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: USER_PROMPT,
      schema: analysisResponseSchema,
      requestId,
      userId: (req as any).user?.id,
    });

    // Persist — next identical scan hits L0/L1 instead of AI
    void saveProduct(aiResult.response, {
      imageHash,
      barcode: barcode ?? undefined,
      source: "ai",
    });

    logger.info({
      provider: aiResult.provider,
      ms: Date.now() - t0,
      product: aiResult.response.detectedProduct,
    }, "L3: AI result persisted");

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
