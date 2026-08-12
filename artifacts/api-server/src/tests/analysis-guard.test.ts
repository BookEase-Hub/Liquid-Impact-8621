import { describe, expect, it } from "vitest";
import { guardAnalysis } from "../services/intelligence/analysis-guard";

function food(overrides: Record<string, unknown> = {}) {
  return {
    id: "scan_stale",
    detectedProduct: "Test food",
    category: "solid_food",
    liquidType: "other",
    consumableType: "solid_food",
    confidenceScore: 0.9,
    composition: {
      calories: 300,
      carbsGrams: 35,
      sugarGrams: 4,
      caffeineMg: 0,
      sodiumMg: 200,
      fatGrams: 8,
      proteinGrams: 15,
      fiberGrams: 6,
      servingSize: 200,
      servingUnit: "g",
    },
    ...overrides,
  };
}

describe("analysis guard", () => {
  it("withholds contradictory egg nutrition instead of returning zero protein", () => {
    const result = guardAnalysis(food({
      detectedProduct: "Cooked eggs with onion and tomato",
      composition: { ...food().composition, proteinGrams: 0 },
    }));

    expect(result.confidenceScore).toBeLessThanOrEqual(0.35);
    expect(result.nutritionEstimateUnavailable).toBe(true);
    expect(result.composition.proteinGrams).toBeNull();
    expect(result.uncertaintyNotes.join(" ")).toMatch(/egg/i);
  });

  it("does not give cowpeas leafy-vegetable nutrition", () => {
    const result = guardAnalysis(food({
      detectedProduct: "Cooked cowpeas",
      composition: { ...food().composition, proteinGrams: 0, fiberGrams: 0 },
    }));

    expect(result.nutritionEstimateUnavailable).toBe(true);
    expect(result.composition.proteinGrams).toBeNull();
    expect(result.composition.fiberGrams).toBeNull();
  });

  it("reclassifies a food identity that was incorrectly emitted as a beverage", () => {
    const result = guardAnalysis({
      ...food(),
      detectedProduct: "Rice",
      consumableType: "beverage",
      category: "other",
      isBeverage: true,
    });

    expect(result.consumableType).toBe("solid_food");
    expect(result.isBeverage).toBe(false);
    expect(result.liquidType).toBe("other");
  });

  it("keeps multiple visible components as a mixed meal", () => {
    const result = guardAnalysis(food({
      detectedProduct: "Egg, tomato and onion",
      componentBreakdown: [
        { component: "egg", percentage: 50, impactScore: 65, evidence: "visual" },
        { component: "tomato", percentage: 25, impactScore: 80, evidence: "visual" },
        { component: "onion", percentage: 25, impactScore: 75, evidence: "visual" },
      ],
    }));

    expect(result.consumableType).toBe("mixed_meal");
    expect(result.category).toBe("mixed_meal");
    expect(result.componentBreakdown).toHaveLength(3);
  });

  it("rejects a false condiment classification for rice", () => {
    const result = guardAnalysis(food({
      detectedProduct: "Rice",
      category: "condiment",
      consumableType: "condiment",
    }));

    expect(result.consumableType).toBe("solid_food");
    expect(result.category).toBe("solid_food");
    expect(result.uncertaintyNotes.join(" ")).toMatch(/classification|uncertain/i);
  });

  it("preserves legitimate zero nutrition for water", () => {
    const result = guardAnalysis({
      ...food(),
      detectedProduct: "Plain water",
      category: "water",
      liquidType: "beverage",
      consumableType: "beverage",
      composition: {
        ...food().composition,
        calories: 0,
        carbsGrams: 0,
        sugarGrams: 0,
        fatGrams: 0,
        proteinGrams: 0,
        fiberGrams: 0,
      },
    });

    expect(result.composition.calories).toBe(0);
    expect(result.nutritionEstimateUnavailable).not.toBe(true);
  });

  it("freshens cached data without mutating the cached record", () => {
    const cached = food({ detectedProduct: "Possible rice", confidenceScore: 0.4 });
    const result = guardAnalysis(cached);

    expect(result.id).not.toBe(cached.id);
    expect(result.id).toMatch(/^scan_/);
    expect(cached.id).toBe("scan_stale");
    expect(cached.composition.proteinGrams).toBe(15);
  });
});