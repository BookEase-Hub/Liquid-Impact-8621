import type { ScanResult } from "@/types";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const SCAN_TIMEOUT_MS = 15_000; // 15s — fast enough for Gemini Flash

export async function analyzeDrink(
  imageBase64: string,
  productHint?: string,
): Promise<ScanResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/scans/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64,
        ...(productHint ? { productHint } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error ?? "Failed to analyze drink");
    }

    const data = await response.json();
    return { ...data, scannedAt: Date.now() } as ScanResult;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Analysis timed out. Try a clearer photo or use Search mode.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadScan(
  scan: ScanResult,
  accessToken: string,
): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    await fetch(`${API_BASE}/scans/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(scan),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch {
    // Fire-and-forget — local storage is source of truth
  }
}

export async function fetchCloudScans(
  accessToken: string,
): Promise<ScanResult[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(`${API_BASE}/scans`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) return [];
    const data = await response.json().catch(() => ({ scans: [] }));
    return (data.scans ?? []) as ScanResult[];
  } catch {
    return [];
  }
}
