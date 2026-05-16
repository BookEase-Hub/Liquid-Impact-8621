import type { ScanResult } from "@/types";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export async function analyzeDrink(imageBase64: string): Promise<ScanResult> {
  const response = await fetch(`${API_BASE}/scans/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? "Failed to analyze drink");
  }

  const data = await response.json();
  return { ...data, scannedAt: Date.now() } as ScanResult;
}

export async function uploadScan(
  scan: ScanResult,
  accessToken: string,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/scans/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(scan),
    });
  } catch {
    // Fire-and-forget — local storage is source of truth
  }
}

export async function fetchCloudScans(
  accessToken: string,
): Promise<ScanResult[]> {
  const response = await fetch(`${API_BASE}/scans`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return [];

  const data = await response.json().catch(() => ({ scans: [] }));
  return (data.scans ?? []) as ScanResult[];
}
