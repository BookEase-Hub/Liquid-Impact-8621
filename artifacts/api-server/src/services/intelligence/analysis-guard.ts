import { generateScanId } from "../schema/analysis.schema";

type AnalysisData = Record<string, any>;

const FOOD_TYPES = new Set(["solid_food", "mixed_meal", "snack"]);
const CONDIMENT_TERMS = /\b(ketchup|hot\s+sauce|soy\s+sauce|mustard|mayonnaise|mayo|vinegar|relish|chutney)\b/i;
const EGG_TERMS = /\b(egg|eggs|omelet|omelette|frittata|scrambled)\b/i;
const LEGUME_TERMS = /\b(cowpeas?|black[-\s]?eyed peas?|beans?|lentils?|chickpeas?|garbanzo|peas?|pulses?)\b/i;
const LEAFY_TERMS = /\b(sukuma|kale|spinach|collard|cabbage|lettuce|greens?|vegetables?)\b/i;
const PROTEIN_TERMS = /\b(chicken|beef|cow|goat|lamb|pork|turkey|fish|salmon|tuna|meat|prawn|shrimp|tofu|tempeh)\b/i;
const CARB_TERMS = /\b(rice|pasta|noodles?|ramen|bread|chapati|ugali|couscous|biryani|dosa|pizza|tortilla|potato|sweet potato)\b/i;
const WATER_TERMS = /\b(water|sparkling water|mineral water)\b/i;

function addNote(data: AnalysisData, note: string): void {
  const notes = Array.isArray(data.uncertaintyNotes) ? data.uncertaintyNotes : [];
  if (!notes.includes(note)) data.uncertaintyNotes = [...notes, note];
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullNutrition(data: AnalysisData, reason: string): void {
  const composition = data.composition;
  if (!composition || typeof composition !== "object") return;
  for (const key of [
    "calories",
    "carbsGrams",
    "sugarGrams",
    "caffeineMg",
    "sodiumMg",
    "fatGrams",
    "proteinGrams",
    "fiberGrams",
  ]) {
    if (key in composition) composition[key] = null;
  }
  data.nutritionEstimateUnavailable = true;
  addNote(data, reason);
}

function normalizeComponents(data: AnalysisData): void {
  const components = Array.isArray(data.componentBreakdown) ? data.componentBreakdown : [];
  data.componentBreakdown = components
    .filter((component) => component && typeof component === "object" && typeof component.component === "string")
    .slice(0, 12)
    .map((component) => ({
      component: String(component.component).slice(0, 80),
      percentage: Math.max(0, Math.min(100, Number(component.percentage) || 0)),
      impactScore: Math.max(0, Math.min(100, Number(component.impactScore) || 0)),
      ...(typeof component.confidence === "number"
        ? { confidence: Math.max(0, Math.min(1, component.confidence)) }
        : {}),
      ...(typeof component.portionGrams === "number"
        ? { portionGrams: Math.max(0, component.portionGrams) }
        : {}),
      ...(component.evidence === "visual" || component.evidence === "likely" || component.evidence === "unknown"
        ? { evidence: component.evidence }
        : {}),
    }));
}

/**
 * Fast, deterministic post-processing gate. It does not make a new AI call:
 * it rejects obvious identity/nutrition contradictions and downgrades claims
 * when visual evidence is insufficient.
 */
export function guardAnalysis(input: AnalysisData): AnalysisData {
  const data: AnalysisData = {
    ...JSON.parse(JSON.stringify(input)),
    id: generateScanId(),
    uncertaintyNotes: Array.isArray(input.uncertaintyNotes) ? [...input.uncertaintyNotes] : [],
  };
  const name = String(data.detectedProduct ?? "Unidentified food or drink");
  const lowerName = name.toLowerCase();
  const composition = data.composition && typeof data.composition === "object"
    ? data.composition
    : (data.composition = {});
  const confidence = numeric(data.confidenceScore) ?? 0.25;
  const isWater = WATER_TERMS.test(name) || data.category === "water";
  let isFood = FOOD_TYPES.has(String(data.consumableType));

  normalizeComponents(data);

  // A model can incorrectly emit "beverage" for a visually ambiguous plate.
  // Strong food identity terms must not inherit beverage scoring/nutrition.
  const namedFood = EGG_TERMS.test(name) ||
    LEGUME_TERMS.test(name) ||
    LEAFY_TERMS.test(name) ||
    PROTEIN_TERMS.test(name) ||
    CARB_TERMS.test(name);
  if (namedFood && !isFood) {
    isFood = true;
    data.consumableType = data.componentBreakdown.length >= 2 ? "mixed_meal" : "solid_food";
    data.category = data.componentBreakdown.length >= 2 ? "mixed_meal" : "solid_food";
    data.liquidType = "other";
    data.isBeverage = false;
    data.confidenceScore = Math.min(confidence, 0.55);
    addNote(data, "Food identity and beverage classification conflicted; the result was reclassified as food.");
  }

  const candidateList = Array.isArray(data.identificationCandidates)
    ? data.identificationCandidates
        .filter((candidate: any) => candidate && typeof candidate.name === "string")
        .slice(0, 5)
        .map((candidate: any) => ({
          name: String(candidate.name).slice(0, 80),
          confidence: Math.max(0, Math.min(1, Number(candidate.confidence) || 0)),
          evidence: candidate.evidence === "visual" || candidate.evidence === "likely" || candidate.evidence === "unknown"
            ? candidate.evidence
            : "unknown",
        }))
    : [];
  data.identificationCandidates = candidateList;

  if (!Array.isArray(data.visualEvidence)) data.visualEvidence = [];
  data.visualEvidence = data.visualEvidence
    .filter((item: unknown) => typeof item === "string")
    .slice(0, 8)
    .map((item: string) => item.slice(0, 140));
  if (!Array.isArray(data.confirmedIngredients)) data.confirmedIngredients = [];
  if (!Array.isArray(data.uncertainIngredients)) data.uncertainIngredients = [];
  data.confirmedIngredients = data.confirmedIngredients.filter((item: unknown) => typeof item === "string").slice(0, 20);
  data.uncertainIngredients = data.uncertainIngredients.filter((item: unknown) => typeof item === "string").slice(0, 20);

  // Only a small, explicit condiment vocabulary may produce condiment output.
  const isCookingLiquid = ["cooking_oil", "olive_oil", "vegetable_oil", "syrup", "extract"].includes(String(data.category));
  if ((data.consumableType === "condiment" || data.category === "condiment") && !isCookingLiquid && !CONDIMENT_TERMS.test(name)) {
    data.consumableType = "solid_food";
    data.category = "other";
    data.liquidType = "other";
    data.confidenceScore = Math.min(confidence, 0.45);
    addNote(data, "The condiment classification was rejected because no condiment was identified.");
  }

  // Visible multi-item meals must stay component-aware.
  if (data.componentBreakdown.length >= 2 && isFood) {
    data.consumableType = "mixed_meal";
    if (data.category === "solid_food" || data.category === "other") data.category = "mixed_meal";
  }

  const protein = numeric(composition.proteinGrams);
  const carbs = numeric(composition.carbsGrams);
  const fiber = numeric(composition.fiberGrams);
  const calories = numeric(composition.calories);
  const fat = numeric(composition.fatGrams);
  const sugar = numeric(composition.sugarGrams);

  // Identity-family checks prevent a wrong visual guess from receiving a
  // contradictory macro profile. Unknown hidden ingredients remain unknown.
  const contradictionChecks: Array<[boolean, string]> = [
    [EGG_TERMS.test(lowerName) && isFood && protein !== null && protein < 3, "Egg identification conflicts with the reported protein; nutrition was withheld."],
    [LEGUME_TERMS.test(lowerName) && isFood && (protein !== null && protein < 2 || fiber !== null && fiber < 2), "Legume identification conflicts with the reported protein or fiber; nutrition was withheld."],
    [PROTEIN_TERMS.test(lowerName) && isFood && protein !== null && protein < 5, "Protein-food identification conflicts with the reported protein; nutrition was withheld."],
    [CARB_TERMS.test(lowerName) && isFood && carbs !== null && carbs < 8, "Starch identification conflicts with the reported carbohydrate value; nutrition was withheld."],
    [LEAFY_TERMS.test(lowerName) && isFood && protein !== null && protein > 30 && calories !== null && calories > 500, "Leafy-vegetable identification conflicts with the reported energy density; nutrition was withheld."],
  ];
  for (const [failed, note] of contradictionChecks) {
    if (failed) {
      data.confidenceScore = Math.min(numeric(data.confidenceScore) ?? confidence, 0.35);
      nullNutrition(data, note);
      break;
    }
  }

  // Macro arithmetic is a cheap consistency check. Recalculate only when
  // enough macros are present; otherwise preserve nulls rather than inventing.
  if (calories !== null && protein !== null && carbs !== null && fat !== null) {
    const expectedCalories = protein * 4 + carbs * 4 + fat * 9;
    if (expectedCalories > 0 && Math.abs(calories - expectedCalories) / expectedCalories > 0.4) {
      data.confidenceScore = Math.min(numeric(data.confidenceScore) ?? confidence, 0.45);
      composition.calories = null;
      data.nutritionEstimateUnavailable = true;
      addNote(data, "Reported calories do not agree with the reported macronutrients.");
    }
  }

  // Zero is meaningful for plain water, not an unknown food.
  const effectiveConfidence = numeric(data.confidenceScore) ?? confidence;
  if (!isWater && isFood && effectiveConfidence < 0.7) {
    nullNutrition(data, "Nutrition is unavailable because the food identity or portion is not sufficiently visible.");
  }

  if (!isWater && !isFood && effectiveConfidence < 0.55) {
    nullNutrition(data, "Nutrition is unavailable because the drink identity is not sufficiently visible.");
  }

  if (typeof data.confidenceScore !== "number") data.confidenceScore = 0.25;
  data.confidenceScore = Math.max(0, Math.min(1, data.confidenceScore));
  if (data.confidenceScore < 0.6 && !/^possible\b|^unidentified\b/i.test(name)) {
    data.detectedProduct = `Possible ${name}`;
  }
  if (data.confidenceScore < 0.7) {
    addNote(data, "Identification is uncertain; retake the image with the full item visible.");
  }

  // Never let a stale model identity survive this boundary.
  if (!data.metadata || typeof data.metadata !== "object") data.metadata = {};
  data.metadata = { ...data.metadata, analysisGuard: "v1" };
  return data;
}