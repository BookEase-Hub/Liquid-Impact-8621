import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { TierConfig, BillingCycle } from '../types';
import { springs } from '../animations';

interface TierCardProps {
  config: TierConfig;
  isSelected: boolean;
  billingCycle: BillingCycle;
  onSelect: (id: TierConfig['id']) => void;
}

export const TierCard = memo(function TierCard({
  config,
  isSelected,
  billingCycle,
  onSelect,
}: TierCardProps) {
  const scale = useSharedValue(1);
  const selectedProgress = useSharedValue(isSelected ? 1 : 0);

  React.useEffect(() => {
    selectedProgress.value = withSpring(isSelected ? 1 : 0, springs.gentle);
  }, [isSelected, selectedProgress]);

  const handlePress = useCallback(async () => {
    scale.value = withSpring(0.97, springs.snappy, () => {
      scale.value = withSpring(1, springs.bouncy);
    });
    await Haptics.selectionAsync();
    onSelect(config.id);
  }, [config.id, onSelect, scale]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderWidth: interpolate(selectedProgress.value, [0, 1], [1, 2]),
    borderColor: isSelected ? config.color : `rgba(255,255,255,0.10)`,
    backgroundColor: isSelected
      ? `${config.color}12`
      : config.highlighted
        ? `${config.color}07`
        : 'rgba(18,18,28,0.85)',
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: selectedProgress.value,
    transform: [{ scale: interpolate(selectedProgress.value, [0, 1], [0.5, 1]) }],
  }));

  const price = billingCycle === 'monthly' ? config.monthlyPrice : config.yearlyPrice;
  const priceSuffix =
    config.id === 'free'
      ? 'forever'
      : billingCycle === 'monthly'
        ? '/month'
        : '/year';

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress} style={styles.inner}>
        {/* Row: icon + info + radio */}
        <View style={styles.row}>
          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: `${config.color}18`, borderColor: `${config.color}30` }]}>
            <Ionicons name={config.icon as keyof typeof Ionicons.glyphMap} size={22} color={config.color} />
          </View>

          {/* Info */}
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: '#F0F0FF' }]}>{config.name}</Text>
              {config.badge && (
                <View style={[styles.badge, { backgroundColor: `${config.color}22`, borderColor: `${config.color}40` }]}>
                  <Text style={[styles.badgeText, { color: config.color }]}>{config.badge}</Text>
                </View>
              )}
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: config.color }]}>{price}</Text>
              <Text style={styles.priceSuffix}>{priceSuffix}</Text>
            </View>
            {billingCycle === 'yearly' && config.yearlySavings ? (
              <Text style={styles.savings}>{config.yearlySavings}</Text>
            ) : null}
            <Text style={styles.scanLimit}>{config.scanLimit} scans</Text>
          </View>

          {/* Radio */}
          <View style={[styles.radio, { borderColor: isSelected ? config.color : 'rgba(255,255,255,0.20)' }]}>
            <Animated.View style={[styles.radioDot, { backgroundColor: config.color }, checkStyle]} />
          </View>
        </View>

        {/* Features — shown when selected */}
        {isSelected && (
          <Animated.View
            style={styles.features}
            entering={withTiming as never}
          >
            {config.features.map((feature) => (
              <View key={feature.id} style={styles.featureRow}>
                <View
                  style={[
                    styles.featureIcon,
                    {
                      backgroundColor: feature.included
                        ? 'rgba(0,200,83,0.15)'
                        : 'rgba(255,255,255,0.06)',
                    },
                  ]}
                >
                  <Ionicons
                    name={feature.included ? 'checkmark' : 'close'}
                    size={10}
                    color={feature.included ? '#00C853' : 'rgba(255,255,255,0.30)'}
                  />
                </View>
                <Text
                  style={[
                    styles.featureLabel,
                    { color: feature.included ? '#C0C0D0' : 'rgba(255,255,255,0.30)' },
                  ]}
                >
                  {feature.label}
                  {feature.premium && !feature.included ? ' ✦' : ''}
                </Text>
              </View>
            ))}
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  inner: {
    padding: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
  },
  priceSuffix: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
  savings: {
    color: '#00C853',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  scanLimit: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 2,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  features: {
    marginTop: 14,
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureLabel: {
    fontSize: 13,
  },
});
