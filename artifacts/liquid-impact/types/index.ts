export type ScanStatus = "optimal" | "stable" | "risky" | "damaging";
export type GlycemicImpact = "low" | "moderate" | "high" | "very_high";
export type HealthRole = "positive" | "neutral" | "concerning";
export type RiskLevel = "low" | "medium" | "high";
export type SubscriptionTier = "free" | "starter" | "pro" | "elite";

export interface Ingredient {
  name: string;
  function: string;
  healthRole: HealthRole;
  riskLevel: RiskLevel;
}

export interface Composition {
  calories: number;
  sugarGrams: number;
  caffeineMg: number;
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
  impactScore: number;
  hydrationLevel: number;
  glycemicImpact: GlycemicImpact;
  status: ScanStatus;
  aiInsight: string;
  viralStatement: string;
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
