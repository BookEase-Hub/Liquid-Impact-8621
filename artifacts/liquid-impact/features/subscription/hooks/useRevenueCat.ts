import { useEffect } from 'react';
import { useSubscriptionStore } from '../store';

export function useRevenueCat() {
  const initialize = useSubscriptionStore((s) => s.initialize);
  const isLoading = useSubscriptionStore((s) => s.isLoading);
  const offerings = useSubscriptionStore((s) => s.offerings);
  const currentOffering = useSubscriptionStore((s) => s.currentOffering);
  const tier = useSubscriptionStore((s) => s.tier);
  const entitlements = useSubscriptionStore((s) => s.entitlements);
  const purchaseState = useSubscriptionStore((s) => s.purchaseState);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const hasEntitlement = (identifier: string): boolean => {
    return Boolean(entitlements?.active?.[identifier]?.isActive);
  };

  return {
    isLoading,
    offerings,
    currentOffering,
    tier,
    entitlements,
    purchaseState,
    hasEntitlement,
    isReady: !isLoading && purchaseState !== 'loading',
  };
}
