export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'elite' | 'family';
export type BillingCycle = 'monthly' | 'yearly';

export type PurchaseState =
  | 'idle'
  | 'loading'
  | 'purchasing'
  | 'success'
  | 'error'
  | 'restoring'
  | 'expired'
  | 'trial'
  | 'grace_period'
  | 'billing_retry';

export interface TierFeature {
  id: string;
  label: string;
  included: boolean;
  premium?: boolean;
}

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  icon: string;
  color: string;
  monthlyPrice: string;
  yearlyPrice: string;
  monthlyPriceId?: string;
  yearlyPriceId?: string;
  yearlySavings: string;
  highlighted: boolean;
  badge?: string;
  features: TierFeature[];
  scanLimit: string;
  description: string;
}

export interface EntitlementInfo {
  identifier: string;
  isActive: boolean;
  willRenew: boolean;
  periodType: 'normal' | 'intro' | 'trial';
  latestPurchaseDate: string;
  originalPurchaseDate: string;
  expirationDate?: string;
  store: 'app_store' | 'play_store' | 'stripe' | 'promotional';
  isSandbox: boolean;
  unsubscribeDetectedAt?: string;
  billingIssueDetectedAt?: string;
}

export interface CustomerEntitlements {
  all: Record<string, EntitlementInfo>;
  active: Record<string, EntitlementInfo>;
}

export interface RevenueCatPackage {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    description: string;
    title: string;
    price: number;
    priceString: string;
    currencyCode: string;
    introPrice?: {
      price: number;
      priceString: string;
      period: string;
      cycles: number;
      periodUnit: string;
    };
  };
}

export interface RevenueCatOffering {
  identifier: string;
  serverDescription: string;
  packages: RevenueCatPackage[];
  metadata: Record<string, string>;
}

export interface PaywallExperiment {
  id: string;
  variant: string;
  highlightedTier: SubscriptionTier;
}

export interface SubscriptionState {
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  purchaseState: PurchaseState;
  isLoading: boolean;
  entitlements: CustomerEntitlements | null;
  offerings: RevenueCatOffering[];
  currentOffering: RevenueCatOffering | null;
  experiment: PaywallExperiment | null;
  expiresAt: string | null;
  isTrialing: boolean;
  gracePeriodEndsAt: string | null;
  errorMessage: string | null;
  lastSyncedAt: string | null;
}

export interface SubscriptionActions {
  initialize: () => Promise<void>;
  purchaseTier: (tier: SubscriptionTier, cycle: BillingCycle) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  setBillingCycle: (cycle: BillingCycle) => void;
  setTier: (tier: SubscriptionTier) => void;
  syncWithBackend: () => Promise<void>;
  reset: () => void;
}

export const PRODUCT_MAP: Record<SubscriptionTier, { monthly: string; yearly: string } | null> = {
  free: null,
  starter: { monthly: 'starter_monthly', yearly: 'starter_yearly' },
  pro: { monthly: 'pro_monthly', yearly: 'pro_yearly' },
  elite: { monthly: 'elite_monthly', yearly: 'elite_yearly' },
  family: { monthly: 'family_monthly', yearly: 'family_yearly' },
};

export const TIER_CONFIGS: TierConfig[] = [
  {
    id: 'free',
    name: 'Free',
    icon: 'water-outline',
    color: '#6B6B80',
    monthlyPrice: '$0',
    yearlyPrice: '$0',
    yearlySavings: '',
    highlighted: false,
    scanLimit: '3/day',
    description: 'Get started with basic drink scanning',
    features: [
      { id: 'scans', label: '3 scans per day', included: true },
      { id: 'score', label: 'Basic impact score', included: true },
      { id: 'hydration', label: 'Hydration level', included: true },
      { id: 'short', label: 'Short-term insights', included: true },
      { id: 'fullscore', label: 'Full ingredient analysis', included: false },
      { id: 'longterm', label: 'Long-term health modeling', included: false },
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    icon: 'flash',
    color: '#00B4D8',
    monthlyPrice: '$3.99',
    yearlyPrice: '$24.99',
    monthlyPriceId: 'starter_monthly',
    yearlyPriceId: 'starter_yearly',
    yearlySavings: 'Save 48%',
    highlighted: false,
    scanLimit: '100/month',
    description: 'For casual health-conscious drinkers',
    features: [
      { id: 'scans', label: '100 scans per month', included: true },
      { id: 'score', label: 'Full score + ingredients', included: true },
      { id: 'short', label: 'Short-term insights', included: true },
      { id: 'ads', label: 'Ad-free experience', included: true },
      { id: 'longterm', label: 'Long-term health modeling', included: false, premium: true },
      { id: 'alternatives', label: 'Smart alternatives', included: false, premium: true },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: 'trophy',
    color: '#7B2CBF',
    monthlyPrice: '$7.99',
    yearlyPrice: '$49.99',
    monthlyPriceId: 'pro_monthly',
    yearlyPriceId: 'pro_yearly',
    yearlySavings: 'Save 48%',
    highlighted: true,
    badge: 'Most Popular',
    scanLimit: 'Unlimited',
    description: 'Complete health intelligence for serious users',
    features: [
      { id: 'scans', label: 'Unlimited scans', included: true },
      { id: 'medium', label: 'Medium + Long-term modeling', included: true },
      { id: 'glycemic', label: 'Glycemic impact detection', included: true },
      { id: 'additives', label: 'Additive & sweetener analysis', included: true },
      { id: 'trends', label: 'Weekly trends & export', included: true },
      { id: 'alternatives', label: 'Smart alternatives', included: true },
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    icon: 'sparkles',
    color: '#FFD700',
    monthlyPrice: '$14.99',
    yearlyPrice: '$99.99',
    monthlyPriceId: 'elite_monthly',
    yearlyPriceId: 'elite_yearly',
    yearlySavings: 'Save 44%',
    highlighted: false,
    badge: 'Best Results',
    scanLimit: 'Unlimited',
    description: 'Advanced AI for peak performance optimization',
    features: [
      { id: 'pro', label: 'Everything in Pro', included: true },
      { id: 'ai', label: 'Advanced AI reasoning', included: true },
      { id: 'personal', label: 'Personalized health insights', included: true },
      { id: 'habit', label: 'Habit prediction model', included: true },
      { id: 'content', label: 'Content generation', included: true },
      { id: 'support', label: 'Priority support', included: true },
    ],
  },
  {
    id: 'family',
    name: 'Family',
    icon: 'people',
    color: '#FF6B9D',
    monthlyPrice: '$19.99',
    yearlyPrice: '$119.99',
    monthlyPriceId: 'family_monthly',
    yearlyPriceId: 'family_yearly',
    yearlySavings: 'Save 50%',
    highlighted: false,
    scanLimit: 'Unlimited',
    description: '4 accounts with full Pro features each',
    features: [
      { id: 'accounts', label: '4 member accounts', included: true },
      { id: 'pro', label: 'All Pro features for each', included: true },
      { id: 'family', label: 'Family progress tracking', included: true },
      { id: 'shared', label: 'Shared health insights', included: true },
      { id: 'support', label: 'Priority support', included: true },
      { id: 'billing', label: 'Single billing', included: true },
    ],
  },
];
