export type ScanStatus = "optimal" | "stable" | "risky" | "damaging" | "unknown";
export type GlycemicImpact = "low" | "moderate" | "high" | "very_high";
export type HealthRole =
  | "positive"
  | "neutral"
  | "concerning"
  | "quick-energy"
  | "alertness"
  | "zero-calorie"
  | "antioxidant"
  | "metabolic-support"
  | "energy-metabolism"
  | "liver-support"
  | "energy"
  | "immune-support"
  | "rehydration"
  | "bone-support"
  | "muscle-support"
  | "traditional"
  | "hydration"
  | "flavor"
  | "metabolism-support"
  | "energy-support"
  | "gut-health";
export type RiskLevel = "low" | "medium" | "high" | "moderate";
export type LiquidCategory =
  | "beverage"
  | "cooking_oil"
  | "condiment"
  | "alcohol"
  | "supplement"
  | "other";
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
  source?: string;
  organic?: boolean;
  allergen?: boolean;
}

export type TimeHorizon = 'short' | 'medium' | 'long';

export interface ImpactFluctuation {
  timestamp: number;
  value: number;
  horizon: TimeHorizon;
}

export interface TimeBasedImpact {
  current: number;
  shortTerm: { value: number; trend: 'up' | 'down' | 'stable'; confidence: number };
  mediumTerm: { value: number; trend: 'up' | 'down' | 'stable'; confidence: number };
  longTerm: { value: number; trend: 'up' | 'down' | 'stable'; confidence: number };
  lastUpdated: number;
  fluctuationHistory: { timestamp: number; value: number; horizon: TimeHorizon }[];
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
