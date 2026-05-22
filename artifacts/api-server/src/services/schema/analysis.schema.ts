// artifacts/api-server/src/services/schema/analysis.schema.ts
import { z } from 'zod';

// Reuse your existing schema - this is your contract
export const analysisResponseSchema = z.object({
  // === Identification ===
  id: z.string().regex(/^scan_[a-zA-Z0-9]{8,20}$/, "ID must be 'scan_' + 8-20 alphanumeric"),
  detectedProduct: z.string().min(1).max(100),
  brand: z.string().max(50).nullable(),
  category: z.enum([
    'water', 'soda', 'energy_drink', 'tea', 'coffee', 'juice',
    'alcohol', 'sports_drink', 'dairy', 'plant_milk', 'supplement',
    'cooking_oil', 'vinegar', 'syrup', 'extract', 'unknown',
    'spirits', 'beer', 'wine', 'milk', 'smoothie', 'sport', 'olive_oil', 'vegetable_oil', 'hot_sauce', 'other'
  ]),
  liquidType: z.enum(['beverage', 'cooking_oil', 'condiment', 'alcohol', 'supplement', 'other']).default('beverage'),
  confidenceScore: z.number().min(0).max(1).describe("Model confidence 0.0-1.0"),
  isBeverage: z.boolean().describe("True if intended for drinking, false for cooking/condiment").optional(),

  // === Composition (structured nutrition) ===
  composition: z.object({
    calories: z.number().min(0),
    sugarGrams: z.number().min(0),
    caffeineMg: z.number().min(0),
    sodiumMg: z.number().min(0).optional(),
    fatGrams: z.number().min(0).optional(),
    proteinGrams: z.number().min(0).optional(),
    additives: z.array(z.string()).default([]),
    artificialSweeteners: z.boolean().default(false),
    servingSize: z.number().min(1),
    servingUnit: z.enum(['ml', 'fl_oz', 'can', 'bottle', 'packet', 'tbsp', 'g', 'oz', 'cup']).default('ml'),
    ingredients: z.array(z.object({
      name: z.string(),
      healthRole: z.enum(['positive', 'neutral', 'concerning', 'negative', 'quick-energy', 'alertness', 'zero-calorie', 'antioxidant', 'metabolic-support', 'energy-metabolism', 'liver-support', 'energy', 'immune-support', 'rehydration', 'bone-support', 'muscle-support', 'traditional', 'hydration', 'flavor', 'metabolism-support', 'energy-support', 'gut-health']),
      riskLevel: z.enum(['low', 'medium', 'high', 'moderate']),
      function: z.string().optional(),
      description: z.string().optional(),
      aiNote: z.string().optional(),
      allergen: z.boolean().default(false).optional(),
    })),
  }),

  // === Impact scoring ===
  impactScore: z.number().int().min(0).max(100),
  status: z.enum(['optimal', 'stable', 'risky', 'damaging']),
  hydrationLevel: z.number().min(0).max(100),
  glycemicImpact: z.enum(['low', 'medium', 'high', 'moderate', 'very_high']),
  dehydrationRisk: z.boolean(),
  alcoholContent: z.number().min(0).optional(), // ABV if applicable

  // === Time-based impacts (your unique value prop) ===
  shortTermImpact: z.object({
    energyResponse: z.string().max(300),
    bloodSugarResponse: z.string().max(300),
    bodyReaction: z.string().max(300),
    hydrationImpact: z.string().max(300),
  }),

  mediumTermImpact: z.object({
    energyStability: z.string().max(300),
    physicalChanges: z.string().max(300),
    habitRisk: z.string().max(300),
    sleepQuality: z.string().max(300),
  }),

  longTermImpact: z.object({
    healthTrend: z.string().max(300),
    metabolicImpact: z.string().max(300),
    riskAccumulation: z.string().max(300),
    nutritionalBalance: z.string().max(300),
  }),

  // === Viral & engagement content ===
  viralStatement: z.string().max(200).describe("Shareable one-liner for social"),
  tiktokHook: z.string().max(100).optional().describe("Short hook for TikTok/Reels"),

  // === Trust & transparency ===
  aiInsight: z.string().max(500).describe("Key takeaway in 1-2 sentences"),
  aiSummary: z.string().max(600).optional().describe("Brief overall assessment"),
  uncertaintyNotes: z.array(z.string()).optional().describe("When model is unsure"),
  disclaimer: z.string().optional().describe("Medical/legal disclaimer if needed"),
  alternatives: z.array(z.string()).optional(),

  // === Metadata for debugging/telemetry ===
  metadata: z.object({
    processingTimeMs: z.number().optional(),
    providerUsed: z.enum(['gemini', 'openai', 'fallback']).optional(),
    modelVersion: z.string().optional(),
    promptTokens: z.number().optional(),
    completionTokens: z.number().optional(),
    estimatedCost: z.number().optional(),
    escalationTriggered: z.boolean().optional(),
  }).optional(),
});

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

// Helper: Generate a valid scan ID
export function generateScanId(): string {
  return `scan_${Math.random().toString(36).substring(2, 10)}`;
}

// Helper: Validate beverage vs cooking liquid
export function validateBeverageClassification(response: Partial<AnalysisResponse>): {
  valid: boolean;
  warning?: string;
} {
  if (!response.category) return { valid: false, warning: 'Missing category' };

  const cookingLiquids = ['cooking_oil', 'olive_oil', 'vegetable_oil', 'vinegar', 'syrup', 'extract', 'hot_sauce'] as const;
  const isCooking = cookingLiquids.includes(response.category as any);

  if (isCooking && response.liquidType === 'beverage') {
    return {
      valid: false,
      warning: 'Cooking liquid should not have liquidType: beverage',
    };
  }

  return { valid: true };
}
