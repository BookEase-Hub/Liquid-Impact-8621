/**
 * Open Food Facts integration — Layer 2 product lookup.
 * Free API, no authentication required.
 * https://world.openfoodfacts.org
 */

import { createHash } from "crypto";
import { generateScanId } from "./schema/analysis.schema";
import type { AnalysisResponse } from "./schema/analysis.schema";

const OFX_BASE = "https://world.openfoodfacts.org";
const FETCH_TIMEOUT_MS = 8000;

interface OFFNutriments {
  "energy-kcal_serving"?: number;
  "energy-kcal_100g"?: number;
  sugars_serving?: number;
  sugars_100g?: number;
  caffeine_serving?: number;
  caffeine_100g?: number;
  sodium_serving?: number;
  sodium_100g?: number;
  fat_serving?: number;
  fat_100g?: number;
  proteins_serving?: number;
  proteins_100g?: number;
  fiber_serving?: number;
  "alcohol_100g"?: number;
}

interface OFFProduct {
  product_name?: string;
  brands?: string;
  categories_tags?: string[];
  quantity?: string;
  serving_quantity?: number;
  serving_quantity_unit?: string;
  nutriments?: OFFNutriments;
  ingredients_text?: string;
  additives_tags?: string[];
}

// ── Category normalization ─────────────────────────────────────────────────────
function mapCategory(tags: string[] = []): AnalysisResponse["category"] {
  const joined = tags.join(" ").toLowerCase();
  if (joined.includes("water")) return "water";
  if (joined.includes("tea")) return "tea";
  if (joined.includes("coffee")) return "coffee";
  if (joined.includes("juice")) return "juice";
  if (joined.includes("soda") || joined.includes("cola") || joined.includes("carbonated")) return "soda";
  if (joined.includes("energy-drink") || joined.includes("energy drink")) return "energy_drink";
  if (joined.includes("spirits") || joined.includes("whisky") || joined.includes("vodka") || joined.includes("rum")) return "spirits";
  if (joined.includes("beer") || joined.includes("lager") || joined.includes("ale")) return "beer";
  if (joined.includes("wine")) return "wine";
  if (joined.includes("milk") && (joined.includes("plant") || joined.includes("almond") || joined.includes("oat") || joined.includes("soy"))) return "plant_milk";
  if (joined.includes("milk") || joined.includes("dairy")) return "dairy";
  if (joined.includes("smoothie")) return "smoothie";
  if (joined.includes("sport") || joined.includes("isotonic")) return "sports_drink";
  if (joined.includes("alcohol")) return "alcohol";
  return "other";
}

function mapLiquidType(category: AnalysisResponse["category"], alcohol100g: number): AnalysisResponse["liquidType"] {
  if (["spirits", "beer", "wine", "alcohol"].includes(category)) return "alcohol";
  if (alcohol100g > 0.5) return "alcohol";
  return "beverage";
}

// ── Score computation ──────────────────────────────────────────────────────────
interface Scores {
  impactScore: number;
  hydrationLevel: number;
  glycemicImpact: AnalysisResponse["glycemicImpact"];
  status: AnalysisResponse["status"];
  dehydrationRisk: boolean;
}

function computeScores(n: OFFNutriments, category: AnalysisResponse["category"]): Scores {
  const sugar100g = n?.sugars_100g ?? 0;
  const caffeine100g = (n?.caffeine_100g ?? 0) * 1000;
  const alcohol100g = n?.["alcohol_100g"] ?? 0;

  // Glycemic impact from sugar density
  let glycemicImpact: AnalysisResponse["glycemicImpact"];
  if (sugar100g < 2.5) glycemicImpact = "low";
  else if (sugar100g < 6) glycemicImpact = "moderate";
  else if (sugar100g < 12) glycemicImpact = "high";
  else glycemicImpact = "very_high";

  // Hydration level by category
  const hydMap: Partial<Record<string, number>> = {
    water: 100, tea: 90, coffee: 85, dairy: 80, plant_milk: 80,
    juice: 75, smoothie: 70, sports_drink: 65, sport: 65,
    soda: 35, energy_drink: 25, beer: 30, wine: 25, spirits: 15, alcohol: 20,
  };
  let hydrationLevel = hydMap[category] ?? 70;
  if (alcohol100g > 3) hydrationLevel = Math.min(hydrationLevel, 25);

  // Impact score
  const baseMap: Partial<Record<string, number>> = {
    water: 98, tea: 86, coffee: 72, juice: 62, smoothie: 70,
    dairy: 65, plant_milk: 68, sports_drink: 52, sport: 52,
    soda: 28, energy_drink: 18, beer: 18, wine: 28, spirits: 10, alcohol: 15, other: 52,
  };
  let impactScore = baseMap[category] ?? 50;

  // Sugar penalty
  if (sugar100g > 12) impactScore -= 20;
  else if (sugar100g > 6) impactScore -= 10;
  else if (sugar100g < 2.5) impactScore += 4;

  // Caffeine penalty
  if (caffeine100g > 100) impactScore -= 12;
  else if (caffeine100g > 30) impactScore -= 4;

  // Alcohol cap
  if (alcohol100g > 0.5) impactScore = Math.min(impactScore, 28);

  impactScore = Math.max(0, Math.min(100, Math.round(impactScore)));

  let status: AnalysisResponse["status"];
  if (impactScore >= 80) status = "optimal";
  else if (impactScore >= 50) status = "stable";
  else if (impactScore >= 25) status = "risky";
  else status = "damaging";

  const dehydrationRisk = hydrationLevel < 40 || alcohol100g > 0.5;

  return { impactScore, hydrationLevel, glycemicImpact, status, dehydrationRisk };
}

// ── Insight generation ─────────────────────────────────────────────────────────
function generateInsight(name: string, category: string, scores: Scores, n: OFFNutriments): string {
  const sugar = Math.round(n?.sugars_serving ?? (n?.sugars_100g ?? 0) * 2.5);
  const caffeine = Math.round((n?.caffeine_serving ?? (n?.caffeine_100g ?? 0) * 2.5) * 1000);
  const alcohol = n?.["alcohol_100g"] ?? 0;

  if (category === "water") return `${name} provides pure hydration with zero calories, zero sugar, and no additives — perfectly aligned with human physiology.`;
  if (category === "tea") return `${name} is a low-calorie drink rich in antioxidants. Moderate caffeine content (if present) combines with natural L-theanine for calm, focused energy.`;
  if (category === "coffee") return `${name} delivers caffeine for cognitive performance. ${caffeine > 0 ? `At ${caffeine}mg per serving, ` : ""}best consumed black to preserve its antioxidant benefit.`;
  if (category === "juice") return `${name} provides vitamins and minerals but contains ${sugar}g of sugar per serving without the fibre buffer of whole fruit, leading to faster blood sugar absorption.`;
  if (category === "soda") return `${name} contains approximately ${sugar}g of sugar per serving — ${Math.round(sugar / 4)} teaspoons. Regular consumption contributes to blood sugar instability and dental erosion.`;
  if (category === "energy_drink") return `${name} combines high caffeine (${caffeine}mg) with sugar for a rapid energy spike. The resulting crash within 2-3 hours makes it unsuitable for daily use.`;
  if (["beer", "wine", "spirits", "alcohol"].includes(category)) return `${name} contains alcohol (${alcohol.toFixed(1)}% per 100ml), a hepatotoxin processed at ~1 unit/hour. Even moderate intake disrupts sleep architecture and dehydrates the body.`;
  if (["dairy", "plant_milk"].includes(category)) return `${name} provides protein and calcium with moderate caloric density. ${sugar > 10 ? "Added sugars detected — check label for flavoured varieties." : "A balanced contribution to daily nutrition."}`;
  if (scores.status === "optimal") return `${name} is a healthy choice with a strong nutritional profile. Low sugar, good hydration, and minimal additives support your wellness goals.`;
  if (scores.status === "stable") return `${name} is a moderate beverage choice. Suitable in balanced quantities as part of a varied diet.`;
  return `${name} has a lower health impact profile. ${sugar > 8 ? `High sugar content (${sugar}g per serving) ` : ""}${caffeine > 80 ? `and elevated caffeine (${caffeine}mg) ` : ""}warrant mindful consumption.`;
}

function generateViralStatement(category: string, scores: Scores, name: string): string {
  if (category === "water") return "The only drink your body was engineered for";
  if (scores.status === "optimal") return `${name} — your body's perfect match`;
  if (scores.status === "damaging") return "Your body is paying interest on every sip";
  if (category === "coffee") return "Focus in a cup, with science to back it";
  if (category === "tea") return "Ancient wisdom confirmed by modern research";
  return "Know what you drink — your body keeps score";
}

function generateShortTerm(category: string, scores: Scores, caffeine: number, sugar: number): AnalysisResponse["shortTermImpact"] {
  const high_sugar = sugar > 8;
  const high_caffeine = caffeine > 60;
  return {
    energyResponse: high_caffeine ? `Rapid caffeine spike within 20-30 min, followed by a crash at ${Math.round(caffeine / 30)} hours` : high_sugar ? "Quick sugar energy, followed by a dip within 60-90 min" : "Steady, manageable energy contribution",
    bloodSugarResponse: scores.glycemicImpact === "very_high" ? "Very rapid blood sugar surge — high glycemic load" : scores.glycemicImpact === "high" ? "Notable blood sugar rise expected" : scores.glycemicImpact === "moderate" ? "Moderate, manageable blood sugar response" : "Minimal blood sugar impact",
    bodyReaction: category === "water" ? "Immediate cellular hydration and electrolyte balance" : category === "coffee" ? "Adenosine blocking raises alertness and metabolism" : category === "tea" ? "Gentle antioxidant delivery and calm alertness" : high_sugar ? "Insulin secretion triggered, energy fluctuation expected" : "Normal metabolic processing",
    hydrationImpact: scores.hydrationLevel > 80 ? "Excellent hydration contribution" : scores.hydrationLevel > 50 ? "Moderate hydration benefit" : "Limited hydration — supplement with water",
  };
}

function generateMediumTerm(category: string, scores: Scores): AnalysisResponse["mediumTermImpact"] {
  return {
    energyStability: scores.status === "optimal" ? "Supports consistent, stable energy across the day" : scores.status === "damaging" ? "Contributes to energy volatility with regular use" : "Moderate energy balance with reasonable intake",
    physicalChanges: scores.status === "damaging" ? "Potential weight gain, metabolic stress, and dental impact" : scores.status === "optimal" ? "Supports healthy weight, skin, and digestion" : "Minimal physical impact in moderate quantities",
    habitRisk: ["energy_drink", "soda"].includes(category) ? "Moderate to high caffeine/sugar dependency risk" : category === "coffee" ? "Moderate caffeine dependency with daily use" : "Low habit-formation risk",
    sleepQuality: ["energy_drink"].includes(category) ? "Significant sleep disruption — avoid after 2pm" : category === "coffee" ? "Avoid after 2pm to protect REM sleep quality" : "Minimal sleep disruption",
  };
}

function generateLongTerm(category: string, scores: Scores): AnalysisResponse["longTermImpact"] {
  return {
    healthTrend: scores.status === "optimal" ? "Positive long-term wellness trajectory" : scores.status === "damaging" ? "Chronic consumption linked to metabolic and cardiovascular concerns" : "Neutral long-term impact in moderation",
    metabolicImpact: scores.glycemicImpact === "very_high" ? "Chronic high glycemic load stress on insulin system" : scores.status === "optimal" ? "Supports healthy metabolic function" : "Moderate metabolic consideration",
    riskAccumulation: scores.status === "damaging" ? "Cumulative health risk accumulates with daily use" : scores.status === "optimal" ? "Net positive health accumulation" : "Low cumulative risk with moderate intake",
    nutritionalBalance: scores.status === "optimal" ? "Positive nutritional contribution" : ["soda", "energy_drink"].includes(category) ? "Minimal nutritional value — nutrient-empty calories" : "Moderate nutritional contribution",
  };
}

// ── Ingredient parsing ─────────────────────────────────────────────────────────
function parseIngredients(text: string): AnalysisResponse["composition"]["ingredients"] {
  if (!text) return [];

  const KNOWN: Record<string, { healthRole: AnalysisResponse["composition"]["ingredients"][0]["healthRole"]; riskLevel: "low" | "medium" | "high" | "moderate" }> = {
    caffeine: { healthRole: "alertness", riskLevel: "moderate" },
    sugar: { healthRole: "quick-energy", riskLevel: "moderate" },
    "high fructose corn syrup": { healthRole: "quick-energy", riskLevel: "high" },
    "fructose": { healthRole: "quick-energy", riskLevel: "moderate" },
    "aspartame": { healthRole: "zero-calorie", riskLevel: "moderate" },
    "sucralose": { healthRole: "zero-calorie", riskLevel: "low" },
    "taurine": { healthRole: "energy-metabolism", riskLevel: "low" },
    "vitamin c": { healthRole: "immune-support", riskLevel: "low" },
    "citric acid": { healthRole: "flavor", riskLevel: "low" },
    "water": { healthRole: "hydration", riskLevel: "low" },
    "green tea": { healthRole: "antioxidant", riskLevel: "low" },
    "sodium": { healthRole: "rehydration", riskLevel: "low" },
    "potassium": { healthRole: "rehydration", riskLevel: "low" },
  };

  const raw = text.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(s => s.length > 1 && s.length < 60).slice(0, 12);

  return raw.map(rawName => {
    const matchKey = Object.keys(KNOWN).find(k => rawName.includes(k));
    const known = matchKey ? KNOWN[matchKey] : null;
    return {
      name: rawName.charAt(0).toUpperCase() + rawName.slice(1),
      healthRole: known?.healthRole ?? "neutral" as any,
      riskLevel: known?.riskLevel ?? "low",
    };
  });
}

// ── Main converter: OFacts product → AnalysisResponse ─────────────────────────
function offProductToAnalysis(product: OFFProduct): AnalysisResponse {
  const n = product.nutriments ?? {};
  const category = mapCategory(product.categories_tags);
  const alcohol100g = n["alcohol_100g"] ?? 0;
  const liquidType = mapLiquidType(category, alcohol100g);
  const scores = computeScores(n, category);

  const serving = product.serving_quantity ?? 250;
  const servingUnit = (product.serving_quantity_unit === "g" ? "g" : "ml") as "ml" | "g";

  const scale = serving / 100;
  const calories = Math.round(n["energy-kcal_serving"] ?? (n["energy-kcal_100g"] ?? 0) * scale);
  const sugarGrams = Math.round((n.sugars_serving ?? (n.sugars_100g ?? 0) * scale) * 10) / 10;
  const caffeineMg = Math.round((n.caffeine_serving ?? (n.caffeine_100g ?? 0) * scale) * 1000);
  const sodiumMg = Math.round((n.sodium_serving ?? (n.sodium_100g ?? 0) * scale) * 1000);
  const fatGrams = Math.round((n.fat_serving ?? (n.fat_100g ?? 0) * scale) * 10) / 10;
  const proteinGrams = Math.round((n.proteins_serving ?? (n.proteins_100g ?? 0) * scale) * 10) / 10;

  const insight = generateInsight(product.product_name ?? "This beverage", category, scores, n);
  const viral = generateViralStatement(category, scores, product.product_name ?? "This drink");

  return {
    id: generateScanId(),
    detectedProduct: product.product_name ?? "Unknown Product",
    brand: product.brands?.split(",")[0]?.trim() ?? null,
    category,
    liquidType,
    confidenceScore: 0.92,
    isBeverage: liquidType === "beverage",
    impactScore: scores.impactScore,
    status: scores.status,
    hydrationLevel: scores.hydrationLevel,
    glycemicImpact: scores.glycemicImpact,
    dehydrationRisk: scores.dehydrationRisk,
    aiInsight: insight,
    viralStatement: viral,
    alternatives: [],
    composition: {
      calories,
      sugarGrams,
      caffeineMg,
      sodiumMg,
      fatGrams,
      proteinGrams,
      servingSize: serving,
      servingUnit,
      artificialSweeteners: (product.ingredients_text ?? "").toLowerCase().includes("sucralose") ||
        (product.ingredients_text ?? "").toLowerCase().includes("aspartame"),
      additives: (product.additives_tags ?? []).map(t => t.replace(/^en:/, "")).slice(0, 6),
      ingredients: parseIngredients(product.ingredients_text ?? ""),
    },
    shortTermImpact: generateShortTerm(category, scores, caffeineMg, sugarGrams),
    mediumTermImpact: generateMediumTerm(category, scores),
    longTermImpact: generateLongTerm(category, scores),
    metadata: { providerUsed: "fallback" },
  };
}

// ── API calls ──────────────────────────────────────────────────────────────────
async function offFetch(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "LiquidImpact/1.0 (health analysis app; contact@liquidimpact.app)",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Look up a product by barcode. Returns null if not found or API unavailable.
 */
export async function lookupByBarcode(barcode: string): Promise<AnalysisResponse | null> {
  const data = await offFetch(`${OFX_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,categories_tags,serving_quantity,serving_quantity_unit,nutriments,ingredients_text,additives_tags`);
  if (!data || data.status !== 1 || !data.product) return null;
  try {
    return offProductToAnalysis(data.product as OFFProduct);
  } catch {
    return null;
  }
}

/**
 * Search for a product by name. Returns the top result or null.
 */
export async function searchByName(name: string): Promise<AnalysisResponse | null> {
  const query = encodeURIComponent(name.slice(0, 80));
  const data = await offFetch(
    `${OFX_BASE}/cgi/search.pl?search_terms=${query}&json=1&page_size=1&fields=product_name,brands,categories_tags,serving_quantity,serving_quantity_unit,nutriments,ingredients_text,additives_tags&sort_by=unique_scans_n`
  );
  if (!data?.products?.length) return null;
  try {
    return offProductToAnalysis(data.products[0] as OFFProduct);
  } catch {
    return null;
  }
}
