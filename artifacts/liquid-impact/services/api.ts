import type { ScanResult, GPT4oResponse, LiquidCategory, ConfidenceTier } from "@/types";
import * as FileSystem from 'expo-file-system';

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o';
const SCAN_TIMEOUT_MS = 45_000; // 45s hard timeout — GPT-4o Vision can be slow

export async function analyzeDrink(imageBase64: string): Promise<ScanResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/scans/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64 }),
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
      throw new Error("Analysis timed out — please try again with a clearer photo.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Advanced GPT-4o Vision analysis for fallback
 */
export async function analyzeWithGPT4o(imageUri: string, contextText: string = ''): Promise<GPT4oResponse> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

  try {
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) throw new Error('Image not found');
    const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });

    const systemPrompt = `You are an expert beverage nutritionist and AI vision analyst. Analyze the provided drink label/image. Return ONLY valid JSON matching this structure: { "product": string, "brand": string, "category": LiquidCategory, "nutrition": { "calories": number, "sugarGrams": number, "caffeineMg": number, "sodiumMg": number }, "ingredients": string[], "healthFlags": [{ "type": string, "severity": string, "message": string, "threshold": number, "actual": number }], "impactScore": number (0-100), "hydrationIndex": number (0-100), "alternatives": string[], "confidence": ConfidenceTier, "shortInsight": string }. Category must be one of: water, sparkling_water, juice, smoothie, soda, energy, tea, coffee, milk, plant_milk, alcohol, beer, wine, sports, electrolyte, protein, dairy, condiment, oil, unknown. Impact score should reflect overall health/nutritional value.`;

    const response = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY || ''}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
            { type: 'text', text: `Analyze this beverage label. Additional context: ${contextText}` },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
          ]}
        ],
        max_tokens: 450,
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'AI request failed');
    }

    const data = await response.json();
    let parsed: any;
    try {
      parsed = JSON.parse(data.choices[0].message.content);
    } catch {
      throw new Error('Invalid AI response format');
    }

    return { ...parsed, metadata: { requestTime: startTime, processingTime: Date.now() - startTime } } as GPT4oResponse;
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('AI request timed out');
    throw err;
  } finally {
    clearTimeout(timeout);
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
