export interface BeverageProfile {
  detectedProduct: string;
  brand: string | null;
  category: string;
  liquidType: string;
  impactScore: number;
  hydrationLevel: number;
  glycemicImpact: string;
  status: string;
  composition: {
    calories: number;
    sugarGrams: number;
    caffeineMg: number;
    sodiumMg: number;
    fatGrams: number;
    proteinGrams: number;
  };
}

export const COMMON_BEVERAGES: Record<string, BeverageProfile> = {
  "coca-cola": {
    detectedProduct: "Coca-Cola Classic",
    brand: "Coca-Cola",
    category: "soda",
    liquidType: "beverage",
    impactScore: 18,
    hydrationLevel: 25,
    glycemicImpact: "very_high",
    status: "damaging",
    composition: { calories: 140, sugarGrams: 39, caffeineMg: 34, sodiumMg: 45, fatGrams: 0, proteinGrams: 0 }
  },
  "diet coke": {
    detectedProduct: "Diet Coke",
    brand: "Coca-Cola",
    category: "soda",
    liquidType: "beverage",
    impactScore: 32,
    hydrationLevel: 30,
    glycemicImpact: "low",
    status: "risky",
    composition: { calories: 0, sugarGrams: 0, caffeineMg: 46, sodiumMg: 40, fatGrams: 0, proteinGrams: 0 }
  },
  "pepsi": {
    detectedProduct: "Pepsi",
    brand: "PepsiCo",
    category: "soda",
    liquidType: "beverage",
    impactScore: 18,
    hydrationLevel: 25,
    glycemicImpact: "very_high",
    status: "damaging",
    composition: { calories: 150, sugarGrams: 41, caffeineMg: 38, sodiumMg: 30, fatGrams: 0, proteinGrams: 0 }
  },
  "monster energy": {
    detectedProduct: "Monster Energy",
    brand: "Monster",
    category: "energy",
    liquidType: "beverage",
    impactScore: 12,
    hydrationLevel: 20,
    glycemicImpact: "very_high",
    status: "damaging",
    composition: { calories: 210, sugarGrams: 54, caffeineMg: 160, sodiumMg: 370, fatGrams: 0, proteinGrams: 0 }
  },
  "red bull": {
    detectedProduct: "Red Bull Energy Drink",
    brand: "Red Bull",
    category: "energy",
    liquidType: "beverage",
    impactScore: 14,
    hydrationLevel: 20,
    glycemicImpact: "very_high",
    status: "damaging",
    composition: { calories: 110, sugarGrams: 27, caffeineMg: 80, sodiumMg: 105, fatGrams: 0, proteinGrams: 0 }
  },
  "evian": {
    detectedProduct: "Evian Natural Spring Water",
    brand: "Evian",
    category: "water",
    liquidType: "beverage",
    impactScore: 98,
    hydrationLevel: 100,
    glycemicImpact: "low",
    status: "optimal",
    composition: { calories: 0, sugarGrams: 0, caffeineMg: 0, sodiumMg: 5, fatGrams: 0, proteinGrams: 0 }
  },
  "fiji": {
    detectedProduct: "Fiji Water",
    brand: "Fiji",
    category: "water",
    liquidType: "beverage",
    impactScore: 96,
    hydrationLevel: 100,
    glycemicImpact: "low",
    status: "optimal",
    composition: { calories: 0, sugarGrams: 0, caffeineMg: 0, sodiumMg: 5, fatGrams: 0, proteinGrams: 0 }
  }
};

export function lookupBeverage(text: string): BeverageProfile | null {
  const normalized = text.toLowerCase();
  for (const [key, profile] of Object.entries(COMMON_BEVERAGES)) {
    if (normalized.includes(key)) {
      return profile;
    }
  }
  return null;
}
