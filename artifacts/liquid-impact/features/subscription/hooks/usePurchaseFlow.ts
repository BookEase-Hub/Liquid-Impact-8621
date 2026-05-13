import { useCallback, useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { useSubscriptionStore } from '../store';
import { useRevenueCat } from './useRevenueCat';
import { useSubscriptionAnalytics } from './useSubscriptionAnalytics';
import { SubscriptionTier, BillingCycle } from '../types';

type FlowPhase = 'browse' | 'confirming' | 'purchasing' | 'success' | 'error' | 'restoring';

export function usePurchaseFlow() {
  const [phase, setPhase] = useState<FlowPhase>('browse');
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [pendingCycle, setPendingCycle] = useState<BillingCycle>('yearly');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const purchaseTier = useSubscriptionStore((s) => s.purchaseTier);
  const restorePurchases = useSubscriptionStore((s) => s.restorePurchases);
  const setBillingCycle = useSubscriptionStore((s) => s.setBillingCycle);
  const currentTier = useSubscriptionStore((s) => s.tier);
  const billingCycle = useSubscriptionStore((s) => s.billingCycle);
  const { isReady, offerings } = useRevenueCat();
  const analytics = useSubscriptionAnalytics();

  useEffect(() => {
    analytics.trackPaywallView('app');
  }, [analytics]);

  const selectTier = useCallback((tier: SubscriptionTier) => {
    setPendingTier(tier);
    analytics.trackTierSelected(tier, billingCycle);
    Haptics.selectionAsync();
  }, [billingCycle, analytics]);

  const selectCycle = useCallback((cycle: BillingCycle) => {
    setPendingCycle(cycle);
    setBillingCycle(cycle);
    Haptics.selectionAsync();
  }, [setBillingCycle]);

  const confirmPurchase = useCallback(async () => {
    if (!pendingTier) return false;
    if (pendingTier === 'free') {
      await purchaseTier('free', billingCycle);
      setPhase('success');
      return true;
    }
    setPhase('purchasing');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    analytics.trackPurchaseStarted(pendingTier, pendingCycle);
    try {
      const success = await purchaseTier(pendingTier, pendingCycle);
      if (success) {
        analytics.trackPurchaseSuccess(pendingTier, pendingCycle);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPhase('success');
        return true;
      } else {
        analytics.trackPurchaseError(pendingTier, 'purchase_failed');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPhase('error');
        setErrorMessage('Purchase could not be completed. Please try again.');
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      analytics.trackPurchaseError(pendingTier ?? 'free', msg);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPhase('error');
      setErrorMessage(msg);
      return false;
    }
  }, [pendingTier, pendingCycle, billingCycle, purchaseTier, analytics]);

  const handleRestore = useCallback(async () => {
    setPhase('restoring');
    analytics.trackRestoreStarted();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const restored = await restorePurchases();
      if (restored) {
        analytics.trackRestoreSuccess(currentTier);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPhase('success');
      } else {
        setPhase('browse');
        setErrorMessage('No previous purchases found.');
      }
      return restored;
    } catch {
      setPhase('browse');
      setErrorMessage('Restore failed. Please try again.');
      return false;
    }
  }, [restorePurchases, currentTier, analytics]);

  const dismissError = useCallback(() => {
    setPhase('browse');
    setErrorMessage(null);
  }, []);

  const resetFlow = useCallback(() => {
    setPhase('browse');
    setPendingTier(null);
    setErrorMessage(null);
  }, []);

  return {
    phase,
    pendingTier,
    pendingCycle,
    errorMessage,
    billingCycle,
    isReady,
    offerings,
    selectTier,
    selectCycle,
    confirmPurchase,
    handleRestore,
    dismissError,
    resetFlow,
  };
}
