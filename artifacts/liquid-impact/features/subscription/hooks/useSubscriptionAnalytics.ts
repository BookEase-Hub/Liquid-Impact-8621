import { useCallback } from 'react';
import { SubscriptionTier, BillingCycle } from '../types';

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
}

function track(event: AnalyticsEvent) {
  if (__DEV__) {
    console.log('[Analytics]', event.name, event.properties ?? {});
  }
}

export function useSubscriptionAnalytics() {
  const trackPaywallView = useCallback((source: string) => {
    track({ name: 'paywall_viewed', properties: { source } });
  }, []);

  const trackTierSelected = useCallback((tier: SubscriptionTier, cycle: BillingCycle) => {
    track({ name: 'tier_selected', properties: { tier, cycle } });
  }, []);

  const trackPurchaseStarted = useCallback((tier: SubscriptionTier, cycle: BillingCycle) => {
    track({ name: 'purchase_started', properties: { tier, cycle } });
  }, []);

  const trackPurchaseSuccess = useCallback((tier: SubscriptionTier, cycle: BillingCycle) => {
    track({ name: 'purchase_success', properties: { tier, cycle } });
  }, []);

  const trackPurchaseError = useCallback((tier: SubscriptionTier, error: string) => {
    track({ name: 'purchase_error', properties: { tier, error } });
  }, []);

  const trackRestoreStarted = useCallback(() => {
    track({ name: 'restore_started' });
  }, []);

  const trackRestoreSuccess = useCallback((tier: SubscriptionTier) => {
    track({ name: 'restore_success', properties: { tier } });
  }, []);

  const trackPaywallDismissed = useCallback((selectedTier: SubscriptionTier) => {
    track({ name: 'paywall_dismissed', properties: { selected_tier: selectedTier } });
  }, []);

  return {
    trackPaywallView,
    trackTierSelected,
    trackPurchaseStarted,
    trackPurchaseSuccess,
    trackPurchaseError,
    trackRestoreStarted,
    trackRestoreSuccess,
    trackPaywallDismissed,
  };
}
