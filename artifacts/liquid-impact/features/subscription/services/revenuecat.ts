import { Platform } from 'react-native';
import { SubscriptionTier, BillingCycle, CustomerEntitlements, RevenueCatOffering, PRODUCT_MAP } from '../types';

const REVENUECAT_API_KEY = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
};

const ENTITLEMENT_MAP: Record<SubscriptionTier, string> = {
  free: '',
  starter: 'starter_access',
  pro: 'pro_access',
  elite: 'elite_access',
  family: 'family_access',
};

function tierFromEntitlements(active: Record<string, unknown>): SubscriptionTier {
  const priority: SubscriptionTier[] = ['family', 'elite', 'pro', 'starter'];
  for (const tier of priority) {
    const key = ENTITLEMENT_MAP[tier];
    if (key && key in active) return tier;
  }
  return 'free';
}

interface PurchasesType {
  configure: (config: { apiKey: string }) => void;
  setLogLevel: (level: number) => void;
  getOfferings: () => Promise<{ current: unknown; all: Record<string, unknown> }>;
  purchasePackage: (pkg: unknown) => Promise<{ customerInfo: unknown }>;
  restorePurchases: () => Promise<unknown>;
  getCustomerInfo: () => Promise<unknown>;
  LOG_LEVEL?: { DEBUG: number };
}

let _Purchases: PurchasesType | null = null;
let _initialized = false;
let _mockMode = false;

function getNativePurchases(): PurchasesType | null {
  if (_Purchases !== null) return _Purchases;
  try {
    const mod = require('react-native-purchases') as {
      default?: PurchasesType;
      Purchases?: PurchasesType;
    };
    _Purchases = (mod.default ?? mod.Purchases) as PurchasesType;
    return _Purchases;
  } catch {
    _mockMode = true;
    return null;
  }
}

function mapCustomerInfo(raw: unknown): CustomerEntitlements {
  const info = raw as {
    entitlements?: {
      all?: Record<string, unknown>;
      active?: Record<string, unknown>;
    };
  };
  const all = info?.entitlements?.all ?? {};
  const active = info?.entitlements?.active ?? {};

  const mapEntry = (entry: unknown) => {
    const e = entry as Record<string, unknown>;
    return {
      identifier: String(e.identifier ?? ''),
      isActive: Boolean(e.isActive),
      willRenew: Boolean(e.willRenew),
      periodType: (e.periodType as 'normal' | 'intro' | 'trial') ?? 'normal',
      latestPurchaseDate: String(e.latestPurchaseDate ?? ''),
      originalPurchaseDate: String(e.originalPurchaseDate ?? ''),
      expirationDate: e.expirationDate ? String(e.expirationDate) : undefined,
      store: (e.store as 'app_store' | 'play_store' | 'stripe' | 'promotional') ?? 'app_store',
      isSandbox: Boolean(e.isSandbox),
      unsubscribeDetectedAt: e.unsubscribeDetectedAt ? String(e.unsubscribeDetectedAt) : undefined,
      billingIssueDetectedAt: e.billingIssueDetectedAt ? String(e.billingIssueDetectedAt) : undefined,
    };
  };

  return {
    all: Object.fromEntries(Object.entries(all).map(([k, v]) => [k, mapEntry(v)])),
    active: Object.fromEntries(Object.entries(active).map(([k, v]) => [k, mapEntry(v)])),
  };
}

const MOCK_OFFERINGS: RevenueCatOffering[] = [
  {
    identifier: 'default',
    serverDescription: 'Default offering',
    packages: [
      { identifier: 'starter_monthly', packageType: 'MONTHLY', product: { identifier: 'starter_monthly', description: '', title: 'Starter Monthly', price: 3.99, priceString: '$3.99', currencyCode: 'USD' } },
      { identifier: 'starter_yearly', packageType: 'ANNUAL', product: { identifier: 'starter_yearly', description: '', title: 'Starter Yearly', price: 24.99, priceString: '$24.99', currencyCode: 'USD' } },
      { identifier: 'pro_monthly', packageType: 'MONTHLY', product: { identifier: 'pro_monthly', description: '', title: 'Pro Monthly', price: 7.99, priceString: '$7.99', currencyCode: 'USD' } },
      { identifier: 'pro_yearly', packageType: 'ANNUAL', product: { identifier: 'pro_yearly', description: '', title: 'Pro Yearly', price: 49.99, priceString: '$49.99', currencyCode: 'USD' } },
      { identifier: 'elite_monthly', packageType: 'MONTHLY', product: { identifier: 'elite_monthly', description: '', title: 'Elite Monthly', price: 14.99, priceString: '$14.99', currencyCode: 'USD' } },
      { identifier: 'elite_yearly', packageType: 'ANNUAL', product: { identifier: 'elite_yearly', description: '', title: 'Elite Yearly', price: 99.99, priceString: '$99.99', currencyCode: 'USD' } },
      { identifier: 'family_monthly', packageType: 'MONTHLY', product: { identifier: 'family_monthly', description: '', title: 'Family Monthly', price: 19.99, priceString: '$19.99', currencyCode: 'USD' } },
      { identifier: 'family_yearly', packageType: 'ANNUAL', product: { identifier: 'family_yearly', description: '', title: 'Family Yearly', price: 119.99, priceString: '$119.99', currencyCode: 'USD' } },
    ],
    metadata: {},
  },
];

export const RevenueCatService = {
  get isMockMode() {
    return _mockMode;
  },

  async initialize(): Promise<void> {
    if (_initialized) return;
    const Purchases = getNativePurchases();
    if (!Purchases) {
      console.warn('[RevenueCat] Running in mock mode (native module unavailable in Expo Go)');
      _initialized = true;
      return;
    }
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY.ios : REVENUECAT_API_KEY.android;
    if (!apiKey) {
      console.warn('[RevenueCat] No API key configured — purchases will be simulated');
      _mockMode = true;
      _initialized = true;
      return;
    }
    try {
      if (Purchases.LOG_LEVEL) {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      }
      Purchases.configure({ apiKey });
      _initialized = true;
    } catch (err) {
      console.error('[RevenueCat] configure failed:', err);
      _mockMode = true;
      _initialized = true;
    }
  },

  async getOfferings(): Promise<RevenueCatOffering[]> {
    if (_mockMode) return MOCK_OFFERINGS;
    const Purchases = getNativePurchases();
    if (!Purchases) return MOCK_OFFERINGS;
    try {
      const offerings = await Purchases.getOfferings();
      return Object.values(offerings.all).map((o) => {
        const off = o as {
          identifier: string;
          serverDescription: string;
          metadata?: Record<string, string>;
          availablePackages?: Array<{
            identifier: string;
            packageType: string;
            storeProduct: {
              identifier: string;
              description: string;
              title: string;
              price: number;
              priceString: string;
              currencyCode: string;
              introPrice?: { price: number; priceString: string; period: string; cycles: number; periodUnit: string };
            };
          }>;
        };
        return {
          identifier: off.identifier,
          serverDescription: off.serverDescription,
          metadata: off.metadata ?? {},
          packages: (off.availablePackages ?? []).map((pkg) => ({
            identifier: pkg.identifier,
            packageType: pkg.packageType,
            product: {
              identifier: pkg.storeProduct.identifier,
              description: pkg.storeProduct.description,
              title: pkg.storeProduct.title,
              price: pkg.storeProduct.price,
              priceString: pkg.storeProduct.priceString,
              currencyCode: pkg.storeProduct.currencyCode,
              introPrice: pkg.storeProduct.introPrice,
            },
          })),
        };
      });
    } catch {
      return MOCK_OFFERINGS;
    }
  },

  async purchasePackageById(productId: string, offering: RevenueCatOffering): Promise<CustomerEntitlements> {
    if (_mockMode) {
      await new Promise((r) => setTimeout(r, 1200));
      const tier = (Object.entries(PRODUCT_MAP).find(([, v]) => v && (v.monthly === productId || v.yearly === productId))?.[0] ?? 'pro') as SubscriptionTier;
      const ent = ENTITLEMENT_MAP[tier];
      const now = new Date().toISOString();
      return {
        all: { [ent]: { identifier: ent, isActive: true, willRenew: true, periodType: 'normal', latestPurchaseDate: now, originalPurchaseDate: now, store: 'app_store', isSandbox: true } },
        active: { [ent]: { identifier: ent, isActive: true, willRenew: true, periodType: 'normal', latestPurchaseDate: now, originalPurchaseDate: now, store: 'app_store', isSandbox: true } },
      };
    }
    const Purchases = getNativePurchases();
    if (!Purchases) throw new Error('RevenueCat not available');
    const pkg = offering.packages.find((p) => p.product.identifier === productId);
    if (!pkg) throw new Error(`Package ${productId} not found in offering`);
    const result = await Purchases.purchasePackage(pkg);
    return mapCustomerInfo(result.customerInfo);
  },

  async restorePurchases(): Promise<CustomerEntitlements> {
    if (_mockMode) {
      await new Promise((r) => setTimeout(r, 800));
      return { all: {}, active: {} };
    }
    const Purchases = getNativePurchases();
    if (!Purchases) return { all: {}, active: {} };
    const info = await Purchases.restorePurchases();
    return mapCustomerInfo(info);
  },

  async getCustomerInfo(): Promise<{ entitlements: CustomerEntitlements; tier: SubscriptionTier }> {
    if (_mockMode) {
      return { entitlements: { all: {}, active: {} }, tier: 'free' };
    }
    const Purchases = getNativePurchases();
    if (!Purchases) return { entitlements: { all: {}, active: {} }, tier: 'free' };
    try {
      const info = await Purchases.getCustomerInfo();
      const entitlements = mapCustomerInfo(info);
      const tier = tierFromEntitlements(entitlements.active);
      return { entitlements, tier };
    } catch {
      return { entitlements: { all: {}, active: {} }, tier: 'free' };
    }
  },

  tierFromEntitlements,
};
