export type ScanStatus = "optimal" | "stable" | "risky" | "damaging";
export type GlycemicImpact = "low" | "moderate" | "high" | "very_high";
export type HealthRole = "positive" | "neutral" | "concerning";
export type RiskLevel = "low" | "medium" | "high" | "safe" | "caution" | "avoid";
export type LiquidCategory =
  | "beverage"
  | "cooking_oil"
  | "condiment"
  | "alcohol"
  | "supplement"
  | "water"
  | "sparkling_water"
  | "juice"
  | "smoothie"
  | "soda"
  | "energy"
  | "tea"
  | "coffee"
  | "milk"
  | "plant_milk"
  | "beer"
  | "wine"
  | "sports"
  | "electrolyte"
  | "protein"
  | "dairy"
  | "oil"
  | "other"
  | "unknown";

export type SubscriptionTier =
  | "free"
  | "starter"
  | "pro"
  | "elite"
  | "family";
export type BillingCycle = "monthly" | "yearly";

export interface Ingredient {
  name: string;
  function: string;
  healthRole: HealthRole;
  riskLevel: RiskLevel;
  description?: string;
  aiNote?: string;
}

export interface Composition {
  calories: number;
  sugarGrams: number;
  caffeineMg: number;
  sodiumMg: number;
  fatGrams: number;
  proteinGrams: number;
  servingSize: number;
  servingUnit: string;
  artificialSweeteners: boolean;
  additives: string[];
  ingredients: Ingredient[];
}

export interface ShortTermImpact {
  energyResponse: string;
  bloodSugarResponse: string;
  bodyReaction: string;
  hydrationImpact: string;
}

export interface MediumTermImpact {
  energyStability: string;
  physicalChanges: string;
  habitRisk: string;
  sleepQuality: string;
}

export interface LongTermImpact {
  healthTrend: string;
  metabolicImpact: string;
  riskAccumulation: string;
  nutritionalBalance: string;
}

// New Advanced Types
export type ConfidenceTier = 'VERIFIED' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCERTAIN';
export type MatchMethod = 'barcode' | 'cache' | 'ocr' | 'fuse_search' | 'gpt4o' | 'heuristic' | 'crowdsourced';

export interface NutritionProfile {
  calories: number; sugarGrams: number; caffeineMg: number; sodiumMg: number;
  fatGrams: number; saturatedFatGrams: number; proteinGrams: number;
  fiberGrams: number; additives: number; artificialSweeteners: boolean;
  artificialColors: boolean; preservatives: number;
  servingSize?: number;
  servingUnit?: string;
}

export interface IngredientEntry {
  name: string; type: 'base' | 'flavor' | 'preservative' | 'sweetener' | 'color' | 'stabilizer' | 'vitamin' | 'mineral' | 'enhancer';
  riskLevel: 'safe' | 'caution' | 'avoid'; eNumber?: string; scoreImpact: number;
}

export interface HealthAlert {
  type: 'sugar' | 'caffeine' | 'additives' | 'sodium' | 'saturated_fat' | 'alcohol' | 'allergen' | 'acidic';
  severity: 'info' | 'warning' | 'danger';
  message: string; threshold: number; actual: number;
}

export interface DrinkRecord {
  id: string; name: string; brand: string; barcode: string[]; keywords: string[];
  category: LiquidCategory; subcategory: string; region: string[];
  nutrition: NutritionProfile; ingredients: IngredientEntry[]; healthFlags: HealthAlert[];
  impactScore: number; hydrationIndex: number; glycemicImpact: 'low' | 'moderate' | 'high' | 'very_high';
  alternatives: string[]; variants: string[]; notes: string;
  updatedAt: string; confidence: number; source: 'local_db' | 'ai_enriched' | 'crowdsourced';
}

export interface ScanResult {
  id: string;
  detectedProduct: string;
  brand?: string | null;
  category: string;
  liquidType: LiquidCategory;
  confidenceScore: number;
  impactScore: number;
  hydrationLevel: number;
  glycemicImpact: GlycemicImpact;
  status: ScanStatus;
  aiInsight: string;
  viralStatement: string;
  dehydrationRisk: boolean;
  alternatives?: string[];
  shortTermImpact: ShortTermImpact;
  mediumTermImpact: MediumTermImpact;
  longTermImpact: LongTermImpact;
  composition: Composition;
  scannedAt: number;
  // Advanced fields merged
  healthFlags?: HealthAlert[];
  ingredientsList?: IngredientEntry[];
  confidenceTier?: ConfidenceTier;
  matchMethod?: MatchMethod;
}

export interface GPT4oResponse {
  product: string;
  brand: string;
  category: LiquidCategory;
  nutrition: Partial<NutritionProfile>;
  ingredients: string[];
  healthFlags: HealthAlert[];
  impactScore: number;
  hydrationIndex: number;
  alternatives: string[];
  confidence: ConfidenceTier;
  shortInsight: string;
  mediumTermEffects?: string;
  longTermEffects?: string;
  metadata: { requestTime: number; processingTime: number };
}

export interface DailyMission {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  icon: string;
  xp: number;
}

export interface WeeklyScore {
  day: string;
  shortDay: string;
  score: number;
  count: number;
}

export interface DailyStatus {
  dehydrationRisk: boolean;
  recommendation: string;
  hydration: number;
  energy: number;
  recovery: number;
  focus: number;
}

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  billingCycle?: BillingCycle;
  scansUsedToday: number;
  scansUsedThisMonth: number;
  scanLimitDaily: number | null;
  scanLimitMonthly: number | null;
}

export interface AppState {
  scans: ScanResult[];
  streak: number;
  longestStreak: number;
  lastScanDate: string | null;
  subscription: SubscriptionTier;
  hasOnboarded: boolean | null;
  missions: DailyMission[];
  lastMissionReset: string | null;
}

export type ScanStage =
  | 'IDLE'
  | 'PERMISSION_REQUEST'
  | 'CAMERA_READY'
  | 'SCANNING_BARCODE'
  | 'CHECKING_CACHE'
  | 'OCR_EXTRACTING'
  | 'FUSE_MATCHING'
  | 'AI_FALLBACK'
  | 'DEEP_ENRICHMENT'
  | 'ANALYSIS_COMPLETE'
  | 'ERROR'
  | 'OFFLINE_FALLBACK'
  | 'CROWDSOURCE_LEARNING';
