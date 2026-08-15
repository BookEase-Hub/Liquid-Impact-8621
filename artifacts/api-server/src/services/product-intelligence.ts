/**
 * Product Intelligence — PostgreSQL product database layer.
 * Saves and retrieves full AnalysisResponse objects by imageHash, barcode, or name fingerprint.
 * This is the "AI learns once → reuses forever" layer.
 */

import { createHash } from "crypto";
import { eq, or } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { generateScanId } from "./schema/analysis.schema";
import { cacheGet, cacheSet } from "./cache";
import { logger } from "../lib/logger";
import type { AnalysisResponse } from "./schema/analysis.schema";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * SHA-256 of the first 4KB of the base64 image string — fast and deterministic.
 * Two images of the same drink should hash the same if truly identical.
 */
export function computeImageHash(base64: string): string {
  return createHash("sha256").update(base64.slice(0, 4096)).digest("hex").slice(0, 32);
}

/**
 * Normalized product name fingerprint — lowercase, alphanumeric only, max 64 chars.
 * Used for "same product, different scan" detection.
 */
export function buildFingerprint(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 64);
}

/**
 * Inject a fresh ID and timestamp into a stored analysis before returning it.
 * This ensures every returned scan has a unique ID and a current timestamp.
 */
function freshenResult(analysis: AnalysisResponse): AnalysisResponse {
  return { ...analysis, id: generateScanId(), metadata: { ...(analysis.metadata ?? {}), providerUsed: analysis.metadata?.providerUsed ?? "fallback" } };
}

// ── Cache TTLs ─────────────────────────────────────────────────────────────────
const TTL_IMAGE = 60 * 60 * 24 * 7;   // 7 days for image hash hits
const TTL_BARCODE = 60 * 60 * 24 * 30; // 30 days for barcode hits
const TTL_FINGERPRINT = 60 * 60 * 24;  // 24 hours for name fingerprint hits

// ── Lookups ────────────────────────────────────────────────────────────────────

/** Check in-memory cache first (fastest, zero DB cost). */
export function getCachedByImageHash(imageHash: string): AnalysisResponse | null {
  const hit = cacheGet<AnalysisResponse>(`scan:${imageHash}`);
  if (hit) return freshenResult(hit);
  return null;
}

export function getCachedByBarcode(barcode: string): AnalysisResponse | null {
  const hit = cacheGet<AnalysisResponse>(`barcode:${barcode}`);
  if (hit) return freshenResult(hit);
  return null;
}

export function getCachedByFingerprint(fingerprint: string): AnalysisResponse | null {
  const hit = cacheGet<AnalysisResponse>(`product:${fingerprint}`);
  if (hit) return freshenResult(hit);
  return null;
}

/** Query PostgreSQL products table by imageHash. */
export async function dbLookupByImageHash(imageHash: string): Promise<AnalysisResponse | null> {
  try {
    const rows = await db.select().from(productsTable).where(eq(productsTable.imageHash, imageHash)).limit(1);
    if (!rows[0]?.analysisJson) return null;
    const result = freshenResult(rows[0].analysisJson as AnalysisResponse);
    cacheSet(`scan:${imageHash}`, result, TTL_IMAGE);
    return result;
  } catch (err) {
    logger.warn({ err }, "products DB lookup by imageHash failed");
    return null;
  }
}

/** Query PostgreSQL products table by barcode. */
export async function dbLookupByBarcode(barcode: string): Promise<AnalysisResponse | null> {
  try {
    const rows = await db.select().from(productsTable).where(eq(productsTable.barcode, barcode)).limit(1);
    if (!rows[0]?.analysisJson) return null;
    const result = freshenResult(rows[0].analysisJson as AnalysisResponse);
    cacheSet(`barcode:${barcode}`, result, TTL_BARCODE);
    return result;
  } catch (err) {
    logger.warn({ err }, "products DB lookup by barcode failed");
    return null;
  }
}

/** Query PostgreSQL products table by name fingerprint. */
export async function dbLookupByFingerprint(fingerprint: string): Promise<AnalysisResponse | null> {
  try {
    const rows = await db.select().from(productsTable).where(eq(productsTable.nameFingerprint, fingerprint)).limit(1);
    if (!rows[0]?.analysisJson) return null;
    const result = freshenResult(rows[0].analysisJson as AnalysisResponse);
    cacheSet(`product:${fingerprint}`, result, TTL_FINGERPRINT);
    return result;
  } catch (err) {
    logger.warn({ err }, "products DB lookup by fingerprint failed");
    return null;
  }
}

// ── Save ──────────────────────────────────────────────────────────────────────

export interface SaveOptions {
  imageHash?: string;
  barcode?: string;
  source: "ai" | "openfoodfacts" | "cache";
}

/**
 * Persist a scan result to the products table and populate all cache keys.
 * Safe to call for every AI result — uses upsert logic to avoid duplicates.
 */
export async function saveProduct(result: AnalysisResponse, opts: SaveOptions): Promise<void> {
  const fingerprint = buildFingerprint(result.detectedProduct);

  // Populate in-memory cache immediately
  if (opts.imageHash) cacheSet(`scan:${opts.imageHash}`, result, TTL_IMAGE);
  if (opts.barcode) cacheSet(`barcode:${opts.barcode}`, result, TTL_BARCODE);
  cacheSet(`product:${fingerprint}`, result, TTL_FINGERPRINT);

  // Persist to DB asynchronously (don't block the response)
  try {
    const existing = await db.select({ id: productsTable.id, scanCount: productsTable.scanCount })
      .from(productsTable)
      .where(
        fingerprint
          ? eq(productsTable.nameFingerprint, fingerprint)
          : eq(productsTable.id, "never-match")
      )
      .limit(1);

    if (existing[0]) {
      // Update scan count and refresh analysisJson
      await db.update(productsTable)
        .set({
          scanCount: (existing[0].scanCount ?? 0) + 1,
          analysisJson: result as any,
          updatedAt: new Date(),
          ...(opts.imageHash ? { imageHash: opts.imageHash } : {}),
          ...(opts.barcode ? { barcode: opts.barcode } : {}),
        })
        .where(eq(productsTable.id, existing[0].id));
    } else {
      await db.insert(productsTable).values({
        name: result.detectedProduct,
        brand: result.brand ?? null,
        barcode: opts.barcode ?? null,
        nameFingerprint: fingerprint,
        imageHash: opts.imageHash ?? null,
        category: result.category,
        liquidType: result.liquidType,
        source: opts.source,
        impactScore: result.impactScore,
        hydrationLevel: result.hydrationLevel,
        glycemicImpact: result.glycemicImpact,
        status: result.status,
        analysisJson: result as any,
        scanCount: 1,
      });
    }

    logger.info({ name: result.detectedProduct, source: opts.source, fingerprint }, "Product saved to intelligence DB");
  } catch (err) {
    logger.warn({ err }, "Failed to save product to intelligence DB (non-fatal)");
  }
}
