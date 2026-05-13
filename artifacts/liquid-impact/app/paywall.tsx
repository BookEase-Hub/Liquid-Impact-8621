import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  FadeInDown,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useSubscriptionStore } from '@/features/subscription/store';
import { usePurchaseFlow } from '@/features/subscription/hooks/usePurchaseFlow';
import { TierCard } from '@/features/subscription/components/TierCard';
import { TIER_CONFIGS } from '@/features/subscription/types';
import type { SubscriptionTier } from '@/features/subscription/types';
import { springs } from '@/features/subscription/animations';

const TRUST_BADGES = [
  { icon: 'shield-checkmark' as const, label: 'Secure' },
  { icon: 'refresh' as const, label: '7-day trial' },
  { icon: 'card' as const, label: 'Cancel anytime' },
];

function MockModeBanner() {
  return (
    <View style={styles.mockBanner}>
      <Ionicons name="flask" size={12} color="#FFD700" />
      <Text style={styles.mockBannerText}>Sandbox mode — purchases simulated</Text>
    </View>
  );
}

function PurchasingOverlay({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 200 });
  }, [visible, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!visible) return null;
  return (
    <Animated.View style={[styles.overlay, style]}>
      <View style={styles.overlayCard}>
        <ActivityIndicator size="large" color="#00B4D8" />
        <Text style={styles.overlayTitle}>Processing payment…</Text>
        <Text style={styles.overlaySubtitle}>Please don't close the app</Text>
      </View>
    </Animated.View>
  );
}

function SuccessView({ tier, onDone }: { tier: SubscriptionTier; onDone: () => void }) {
  const cfg = TIER_CONFIGS.find((t) => t.id === tier) ?? TIER_CONFIGS[2];
  const scale = useSharedValue(0.7);
  useEffect(() => {
    scale.value = withSpring(1, springs.bouncy);
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View style={styles.successContainer}>
      <Animated.View style={[styles.successIcon, style]}>
        <LinearGradient
          colors={[cfg.color, '#00B4D8']}
          style={styles.successGradient}
        >
          <Ionicons name="checkmark" size={40} color="#fff" />
        </LinearGradient>
      </Animated.View>
      <Text style={styles.successTitle}>
        {tier === 'free' ? 'Staying Free' : `Welcome to ${cfg.name}!`}
      </Text>
      <Text style={styles.successSubtitle}>
        {tier === 'free'
          ? 'You can always upgrade later from your profile.'
          : 'Your subscription is now active. Start scanning!'}
      </Text>
      <TouchableOpacity style={[styles.successBtn, { backgroundColor: cfg.color }]} onPress={onDone}>
        <Text style={styles.successBtnText}>Start Scanning</Text>
      </TouchableOpacity>
    </View>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Animated.View entering={FadeInDown} style={styles.errorBanner}>
      <Ionicons name="alert-circle" size={16} color="#FF4D6D" />
      <Text style={styles.errorText} numberOfLines={2}>{message}</Text>
      <TouchableOpacity onPress={onDismiss}>
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PaywallScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setSubscription } = useApp();

  const {
    phase,
    pendingTier,
    pendingCycle,
    errorMessage,
    billingCycle,
    isReady,
    selectTier,
    selectCycle,
    confirmPurchase,
    handleRestore,
    dismissError,
  } = usePurchaseFlow();

  const initialize = useSubscriptionStore((s) => s.initialize);
  const storeTier = useSubscriptionStore((s) => s.tier);
  const isMockMode = require('@/features/subscription/services/revenuecat').RevenueCatService.isMockMode as boolean;

  useEffect(() => {
    initialize();
  }, [initialize]);

  const effectiveTier = pendingTier ?? (storeTier === 'free' ? 'pro' : storeTier);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleConfirm = useCallback(async () => {
    const success = await confirmPurchase();
    if (success && pendingTier) {
      setSubscription(pendingTier as import('@/types').SubscriptionTier);
    }
  }, [confirmPurchase, pendingTier, setSubscription]);

  const handleDone = useCallback(() => {
    if (storeTier !== 'free') {
      setSubscription(storeTier as import('@/types').SubscriptionTier);
    }
    router.back();
  }, [router, storeTier, setSubscription]);

  const selectedCfg = TIER_CONFIGS.find((t) => t.id === effectiveTier) ?? TIER_CONFIGS[2];
  const displayPrice =
    billingCycle === 'monthly' ? selectedCfg.monthlyPrice : selectedCfg.yearlyPrice;
  const pricePeriod = billingCycle === 'monthly' ? '/month' : '/year';

  if (phase === 'success') {
    return (
      <View style={[styles.root, { backgroundColor: C.background }]}>
        <SuccessView tier={storeTier} onDone={handleDone} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>
      {/* Close button */}
      <TouchableOpacity
        onPress={handleClose}
        style={[styles.closeBtn, { top: insets.top + 12 }]}
      >
        <Ionicons name="close" size={18} color="#fff" />
      </TouchableOpacity>

      {/* Purchasing overlay */}
      <PurchasingOverlay visible={phase === 'purchasing' || phase === 'restoring'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32 },
        ]}
      >
        {/* Mock mode banner */}
        {isMockMode && <MockModeBanner />}

        {/* Error banner */}
        {errorMessage && (
          <ErrorBanner message={errorMessage} onDismiss={dismissError} />
        )}

        {/* Header */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.header}>
          <LinearGradient
            colors={['#00B4D8', '#7B2CBF']}
            style={styles.headerIcon}
          >
            <Ionicons name="sparkles" size={30} color="#fff" />
          </LinearGradient>
          <Text style={styles.headerEyebrow}>Unlock Full Power</Text>
          <Text style={styles.headerTitle}>
            See exactly what your{'\n'}drinks do to your body
          </Text>
        </Animated.View>

        {/* Billing toggle */}
        <Animated.View
          entering={FadeInDown.delay(80).springify()}
          style={[styles.billingToggle, { backgroundColor: C.backgroundSecondary }]}
        >
          {(['monthly', 'yearly'] as const).map((cycle) => (
            <TouchableOpacity
              key={cycle}
              activeOpacity={0.8}
              onPress={() => selectCycle(cycle)}
              style={[
                styles.billingOption,
                billingCycle === cycle && {
                  backgroundColor: C.primaryDim,
                  borderWidth: 1,
                  borderColor: `${C.primary}40`,
                },
              ]}
            >
              <Text
                style={[
                  styles.billingLabel,
                  { color: billingCycle === cycle ? C.primary : C.mutedForeground },
                ]}
              >
                {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
              </Text>
              {cycle === 'yearly' && (
                <Text style={styles.billingDiscount}>Save up to 50%</Text>
              )}
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Tier cards */}
        {TIER_CONFIGS.map((config, i) => (
          <Animated.View key={config.id} entering={FadeInDown.delay(120 + i * 50).springify()}>
            <TierCard
              config={config}
              isSelected={effectiveTier === config.id}
              billingCycle={billingCycle}
              onSelect={(id) => selectTier(id as SubscriptionTier)}
            />
          </Animated.View>
        ))}

        {/* CTA button */}
        <Animated.View entering={FadeInDown.delay(420).springify()}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleConfirm}
            disabled={!isReady || phase === 'purchasing'}
            style={styles.cta}
          >
            <LinearGradient
              colors={
                effectiveTier === 'free'
                  ? ['#3A3A4A', '#3A3A4A']
                  : [selectedCfg.color, selectedCfg.color === '#FFD700' ? '#FF9800' : '#00B4D8']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              {!isReady ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>
                  {effectiveTier === 'free'
                    ? 'Continue with Free'
                    : `Get ${selectedCfg.name} — ${displayPrice}${pricePeriod}`}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Trust badges */}
        <Animated.View entering={FadeInDown.delay(460).springify()} style={styles.trust}>
          {TRUST_BADGES.map((b) => (
            <View key={b.label} style={styles.trustItem}>
              <Ionicons name={b.icon} size={16} color={C.mutedForeground} />
              <Text style={[styles.trustLabel, { color: C.mutedForeground }]}>{b.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Restore + Legal */}
        <Animated.View entering={FadeInDown.delay(480).springify()} style={styles.legal}>
          <TouchableOpacity onPress={handleRestore}>
            <Text style={[styles.restoreText, { color: C.mutedForeground }]}>
              Restore purchases
            </Text>
          </TouchableOpacity>
          <Text style={[styles.legalText, { color: C.mutedForeground }]}>
            Cancel anytime · Secure payments · 7-day free trial on paid plans
          </Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => Linking.openURL('https://liquidimpact.app/privacy')}>
              <Text style={[styles.legalLink, { color: C.mutedForeground }]}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={{ color: C.mutedForeground, fontSize: 11 }}> · </Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://liquidimpact.app/terms')}>
              <Text style={[styles.legalLink, { color: C.mutedForeground }]}>Terms of Use</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,215,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  mockBannerText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,77,109,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.30)',
    borderRadius: 14,
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: '#FF4D6D',
    fontSize: 13,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerEyebrow: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 14,
  },
  headerTitle: {
    color: '#F0F0FF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 30,
  },
  billingToggle: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
  },
  billingOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  billingLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  billingDiscount: {
    color: '#00C853',
    fontSize: 10,
    fontWeight: '700',
  },
  cta: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  ctaGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  trust: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  trustItem: {
    alignItems: 'center',
    gap: 4,
  },
  trustLabel: {
    fontSize: 11,
  },
  legal: {
    alignItems: 'center',
    gap: 8,
  },
  restoreText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  legalText: {
    fontSize: 11,
    textAlign: 'center',
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legalLink: {
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayCard: {
    backgroundColor: '#151520',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    width: 220,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  overlayTitle: {
    color: '#F0F0FF',
    fontSize: 16,
    fontWeight: '700',
  },
  overlaySubtitle: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 13,
    textAlign: 'center',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 20,
  },
  successIcon: {
    marginBottom: 8,
  },
  successGradient: {
    width: 96,
    height: 96,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    color: '#F0F0FF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  successSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  successBtn: {
    marginTop: 8,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 20,
  },
  successBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
});
