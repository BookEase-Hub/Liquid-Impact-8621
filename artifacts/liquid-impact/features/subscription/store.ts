import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SubscriptionState,
  SubscriptionActions,
  SubscriptionTier,
  BillingCycle,
  PRODUCT_MAP,
} from './types';
import { RevenueCatService } from './services/revenuecat';

const INITIAL_STATE: SubscriptionState = {
  tier: 'free',
  billingCycle: 'yearly',
  purchaseState: 'idle',
  isLoading: false,
  entitlements: null,
  offerings: [],
  currentOffering: null,
  experiment: null,
  expiresAt: null,
  isTrialing: false,
  gracePeriodEndsAt: null,
  errorMessage: null,
  lastSyncedAt: null,
};

type Store = SubscriptionState & SubscriptionActions;

export const useSubscriptionStore = create<Store>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      initialize: async () => {
        set({ isLoading: true, purchaseState: 'loading' });
        try {
          await RevenueCatService.initialize();
          const [{ entitlements, tier }, offerings] = await Promise.all([
            RevenueCatService.getCustomerInfo(),
            RevenueCatService.getOfferings(),
          ]);
          const current = offerings[0] ?? null;
          set({
            tier,
            entitlements,
            offerings,
            currentOffering: current,
            purchaseState: 'idle',
            isLoading: false,
            lastSyncedAt: new Date().toISOString(),
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Initialization failed';
          set({ purchaseState: 'error', errorMessage: msg, isLoading: false });
        }
      },

      purchaseTier: async (tier: SubscriptionTier, cycle: BillingCycle): Promise<boolean> => {
        if (tier === 'free') {
          set({ tier: 'free', purchaseState: 'idle' });
          return true;
        }
        const map = PRODUCT_MAP[tier];
        if (!map) return false;
        const productId = cycle === 'monthly' ? map.monthly : map.yearly;
        const { currentOffering } = get();
        if (!currentOffering) return false;

        set({ purchaseState: 'purchasing', isLoading: true, errorMessage: null });
        try {
          const entitlements = await RevenueCatService.purchasePackageById(productId, currentOffering);
          const resolvedTier = RevenueCatService.tierFromEntitlements(entitlements.active);
          set({
            tier: resolvedTier,
            billingCycle: cycle,
            entitlements,
            purchaseState: 'success',
            isLoading: false,
            lastSyncedAt: new Date().toISOString(),
          });
          return true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Purchase failed';
          const userCancelled = msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('1');
          set({
            purchaseState: userCancelled ? 'idle' : 'error',
            errorMessage: userCancelled ? null : msg,
            isLoading: false,
          });
          return false;
        }
      },

      restorePurchases: async (): Promise<boolean> => {
        set({ purchaseState: 'restoring', isLoading: true });
        try {
          const entitlements = await RevenueCatService.restorePurchases();
          const tier = RevenueCatService.tierFromEntitlements(entitlements.active);
          const restored = tier !== 'free';
          set({
            tier,
            entitlements,
            purchaseState: restored ? 'success' : 'idle',
            isLoading: false,
            lastSyncedAt: new Date().toISOString(),
          });
          return restored;
        } catch {
          set({ purchaseState: 'idle', isLoading: false });
          return false;
        }
      },

      setBillingCycle: (cycle: BillingCycle) => set({ billingCycle: cycle }),

      setTier: (tier: SubscriptionTier) => set({ tier }),

      syncWithBackend: async () => {
        try {
          const { entitlements } = get();
          if (!entitlements) return;
          const syncUrl = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ''}`;
          await fetch(`${syncUrl}/api/subscriptions/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entitlements }),
          });
          set({ lastSyncedAt: new Date().toISOString() });
        } catch {
          // silent — sync will retry next session
        }
      },

      reset: () => set(INITIAL_STATE),
    }),
    {
      name: '@liquid_impact_subscription_v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        tier: s.tier,
        billingCycle: s.billingCycle,
        expiresAt: s.expiresAt,
        isTrialing: s.isTrialing,
        gracePeriodEndsAt: s.gracePeriodEndsAt,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
);

export function selectTier(s: Store) { return s.tier; }
export function selectIsLoading(s: Store) { return s.isLoading; }
export function selectPurchaseState(s: Store) { return s.purchaseState; }
export function selectOfferings(s: Store) { return s.offerings; }
export function selectBillingCycle(s: Store) { return s.billingCycle; }
export function selectErrorMessage(s: Store) { return s.errorMessage; }
