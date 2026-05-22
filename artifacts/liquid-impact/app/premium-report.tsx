// ============================================================================
// LIQUID IMPACT SCAN - PREMIUM WELLNESS REPORT SCREEN
// ============================================================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Animated, Easing, Dimensions, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import type { ScanResult, TimeHorizon, TimeBasedImpact } from '../types';
import {
  THEME,
  NUTRITION_COLORS,
  GLYCEMIC_COLORS,
  RISK_COLORS,
  STATUS_COLORS,
  calculateTimeBasedImpact
} from '../constants/beverages';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ============================================================================
// UI INTERFACES
// ============================================================================

export interface NutritionMetric {
  label: string;
  value: number;
  unit: string;
  max: number;
  color: string;
  description: string;
  healthImpact: 'positive' | 'neutral' | 'negative' | 'warning';
}

export interface WellnessIndicator {
  label: string;
  value: string | number;
  status: string;
  color: string;
  icon: string;
  description: string;
}

export interface IngredientItem {
  name: string;
  function: string;
  healthRole: string;
  riskLevel: string;
  description: string;
  source?: string;
  organic?: boolean;
  allergen?: boolean;
}

export interface EffectEntry {
  title: string;
  description: string;
  icon: string;
  severity: 'info' | 'warning' | 'positive' | 'negative';
  probability: 'low' | 'medium' | 'high';
  timeframe: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface NutritionBarProps extends NutritionMetric {
  animated?: boolean;
  delay?: number;
}

const NutritionBar: React.FC<NutritionBarProps> = ({
  label, value, unit, max, color, description, animated = true, delay = 0
}) => {
  const progress = Math.min(100, Math.max(0, (value / max) * 100));
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedWidth, {
        toValue: progress,
        duration: 800,
        delay,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: false,
      }).start();
    }
  }, [progress, animated, delay]);

  const widthStyle = animated
    ? { width: animatedWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }
    : { width: `${progress}%` as any };

  return (
    <View style={styles.nutritionRow}>
      <View style={styles.nutritionLabelContainer}>
        <Text style={styles.nutritionLabel}>{label}</Text>
        {description && <Text style={styles.nutritionDescription}>{description}</Text>}
      </View>
      <View style={styles.nutritionBarContainer}>
        <View style={styles.nutritionBarTrack}>
          <Animated.View
            style={[
              styles.nutritionBarFill,
              { backgroundColor: color },
              widthStyle
            ]}
          />
        </View>
      </View>
      <Text style={styles.nutritionValue}>{value}{unit}</Text>
    </View>
  );
};

const InfoRow: React.FC<WellnessIndicator> = ({ label, value, status, color, icon, description }) => {
  const statusColor = status ? GLYCEMIC_COLORS[status] || RISK_COLORS[status] || color : color;

  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        {icon && <Ionicons name={icon as any} size={16} color={THEME.colors.textSecondary} style={styles.infoRowIcon} />}
        <Text style={styles.infoRowLabel}>{label}</Text>
      </View>
      <View style={styles.infoRowRight}>
        <Text style={[styles.infoRowValue, { color: statusColor }]}>{value}</Text>
        {description && <Text style={styles.infoRowDescription}>{description}</Text>}
      </View>
    </View>
  );
};

const IngredientItemComponent: React.FC<{ ingredient: IngredientItem; index: number }> = ({ ingredient }) => {
  const riskColor = RISK_COLORS[ingredient.riskLevel] || THEME.colors.info;

  return (
    <View style={styles.ingredientRow}>
      <View style={styles.ingredientDot} />
      <View style={styles.ingredientContent}>
        <Text style={styles.ingredientName}>{ingredient.name}</Text>
        <Text style={styles.ingredientDescription}>{ingredient.description}</Text>
        <Text style={styles.ingredientRole}>
          {ingredient.healthRole.replace('-', ' ').toUpperCase()}
        </Text>
      </View>
      <View style={[styles.riskBadge, { backgroundColor: riskColor + '20', borderColor: riskColor }]}>
        <Text style={[styles.riskBadgeText, { color: riskColor }]}>{ingredient.riskLevel.toUpperCase()}</Text>
      </View>
    </View>
  );
};

const EffectBullet: React.FC<{ effect: EffectEntry; index: number }> = ({ effect }) => {
  const iconColor = {
    info: THEME.colors.info,
    warning: THEME.colors.warning,
    positive: THEME.colors.success,
    negative: THEME.colors.error,
  }[effect.severity];

  const icon = {
    info: 'information-circle-outline',
    warning: 'warning-outline',
    positive: 'checkmark-circle-outline',
    negative: 'close-circle-outline',
  }[effect.severity];

  return (
    <View style={styles.effectRow}>
      <Ionicons name={icon as any} size={18} color={iconColor} style={styles.effectIcon} />
      <View style={styles.effectContent}>
        <Text style={styles.effectTitle}>{effect.title}</Text>
        <Text style={styles.effectDescription}>{effect.description}</Text>
        <Text style={styles.effectTimeframe}>{effect.timeframe} • {effect.probability} probability</Text>
      </View>
    </View>
  );
};

interface GlassCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  accentColor?: string;
  style?: any;
  contentStyle?: any;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, title, subtitle, accentColor, style, contentStyle }) => {
  return (
    <View style={[styles.glassCard, style]}>
      {accentColor && <View style={[styles.glassCardAccent, { backgroundColor: accentColor }]} />}
      {(title || subtitle) && (
        <View style={styles.glassCardHeader}>
          {title && <Text style={styles.glassCardTitle}>{title}</Text>}
          {subtitle && <Text style={styles.glassCardSubtitle}>{subtitle}</Text>}
        </View>
      )}
      <View style={[styles.glassCardContent, contentStyle]}>
        {children}
      </View>
    </View>
  );
};

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  animated?: boolean;
}

const ScoreRing: React.FC<ScoreRingProps> = ({
  score, size = 110, strokeWidth = 14, showLabel = true, animated = true
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(100, Math.max(0, score));
  const offset = circumference - (progress / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 80) return THEME.colors.success;
    if (s >= 50) return THEME.colors.warning;
    if (s >= 25) return THEME.colors.orange;
    return THEME.colors.error;
  };

  const strokeColor = getColor(score);
  const animatedOffset = useRef(new Animated.Value(circumference)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedOffset, {
        toValue: offset,
        duration: 1200,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: false,
      }).start();
    }
  }, [offset, animated]);

  const strokeDashoffset = animated ? animatedOffset : offset;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={THEME.colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset as any}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size/2}, ${size/2}`}
        />
      </Svg>
      {showLabel && (
        <View style={styles.scoreRingLabel}>
          <Text style={[styles.scoreRingValue, { color: strokeColor }]}>{Math.round(score)}</Text>
          <Text style={styles.scoreRingUnit}>/100</Text>
        </View>
      )}
    </View>
  );
};

// ============================================================================
// MAIN SCREEN COMPONENT
// ============================================================================

interface LiquidImpactScanScreenProps {
  route: { params: { result: ScanResult } };
  navigation: any;
}

const LiquidImpactScanScreen: React.FC<LiquidImpactScanScreenProps> = ({ route, navigation }) => {
  const { result } = route.params;
  const insets = useSafeAreaInsets();
  const [timeImpact, setTimeImpact] = useState<TimeBasedImpact>(() =>
    calculateTimeBasedImpact(result.impactScore, result.category)
  );

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.95)).current;

  const nutritionMetrics = useMemo((): NutritionMetric[] => [
    { label: 'Calories', value: result.composition.calories, unit: 'kcal', max: 200, color: NUTRITION_COLORS.calories, description: 'Energy content per serving', healthImpact: result.composition.calories > 100 ? 'negative' : 'neutral' },
    { label: 'Sugar', value: result.composition.sugarGrams, unit: 'g', max: 30, color: NUTRITION_COLORS.sugar, description: 'Added and natural sugars', healthImpact: result.composition.sugarGrams > 10 ? 'negative' : 'neutral' },
    { label: 'Fat', value: result.composition.fatGrams, unit: 'g', max: 15, color: NUTRITION_COLORS.fat, description: 'Total fat content', healthImpact: result.composition.fatGrams > 5 ? 'negative' : 'positive' },
    { label: 'Protein', value: result.composition.proteinGrams, unit: 'g', max: 20, color: NUTRITION_COLORS.protein, description: 'Protein for muscle support', healthImpact: result.composition.proteinGrams > 3 ? 'positive' : 'neutral' },
    { label: 'Sodium', value: result.composition.sodiumMg, unit: 'mg', max: 200, color: NUTRITION_COLORS.sodium, description: 'Electrolyte content', healthImpact: result.composition.sodiumMg > 100 ? 'negative' : 'neutral' },
    { label: 'Caffeine', value: result.composition.caffeineMg, unit: 'mg', max: 100, color: NUTRITION_COLORS.caffeine, description: 'Stimulant content', healthImpact: result.composition.caffeineMg > 40 ? 'warning' : 'neutral' },
  ], [result]);

  const wellnessIndicators = useMemo((): WellnessIndicator[] => [
    {
      label: 'Glycemic Impact',
      value: result.glycemicImpact.toUpperCase(),
      status: result.glycemicImpact,
      color: GLYCEMIC_COLORS[result.glycemicImpact] || THEME.colors.info,
      icon: 'pulse-outline',
      description: 'Effect on blood sugar levels'
    },
    {
      label: 'Dehydration Risk',
      value: result.dehydrationRisk ? 'Significant' : 'Low',
      status: result.dehydrationRisk ? 'risky' : 'optimal',
      color: result.dehydrationRisk ? THEME.colors.error : THEME.colors.success,
      icon: 'water-outline',
      description: 'Potential fluid loss effect'
    },
    {
      label: 'AI Confidence',
      value: `${Math.round(result.confidenceScore * 100)}%`,
      status: 'optimal',
      color: THEME.colors.secondary,
      icon: 'sparkles-outline',
      description: 'Analysis reliability score'
    },
  ], [result]);

  const shortTermEffects = useMemo((): EffectEntry[] => [
    { title: result.shortTermImpact.energyResponse, description: 'Immediate energy and alertness effect', icon: 'bolt-outline', severity: result.composition.caffeineMg > 20 ? 'positive' : 'info', probability: 'high', timeframe: '0-2 hours' },
    { title: result.shortTermImpact.bloodSugarResponse, description: 'Glucose response pattern', icon: 'pulse-outline', severity: result.composition.sugarGrams > 10 ? 'warning' : 'info', probability: 'high', timeframe: '0-2 hours' },
    { title: result.shortTermImpact.bodyReaction, description: 'Physical sensation and comfort', icon: 'body-outline', severity: 'info', probability: 'medium', timeframe: '0-2 hours' },
    { title: result.shortTermImpact.hydrationImpact, description: 'Fluid balance effect', icon: 'water-outline', severity: result.hydrationLevel > 70 ? 'positive' : result.hydrationLevel < 30 ? 'negative' : 'info', probability: 'high', timeframe: '0-2 hours' },
  ], [result]);

  const mediumTermEffects = useMemo((): EffectEntry[] => [
    { title: result.mediumTermImpact.energyStability, description: 'Sustained energy pattern', icon: 'trending-up-outline', severity: 'info', probability: 'medium', timeframe: '2-24 hours' },
    { title: result.mediumTermImpact.physicalChanges, description: 'Body composition considerations', icon: 'body-outline', severity: 'info', probability: 'low', timeframe: '2-24 hours' },
    { title: result.mediumTermImpact.habitRisk, description: 'Consumption pattern guidance', icon: 'repeat-outline', severity: result.composition.sugarGrams > 8 ? 'warning' : 'info', probability: 'medium', timeframe: '2-24 hours' },
    { title: result.mediumTermImpact.sleepQuality, description: 'Sleep impact considerations', icon: 'moon-outline', severity: result.composition.caffeineMg > 25 ? 'warning' : 'info', probability: result.composition.caffeineMg > 25 ? 'high' : 'low', timeframe: '2-24 hours' },
  ], [result]);

  const longTermEffects = useMemo((): EffectEntry[] => [
    { title: result.longTermImpact.healthTrend, description: 'Overall wellness trajectory', icon: 'heart-outline', severity: timeImpact.longTerm.value > 70 ? 'positive' : timeImpact.longTerm.value < 30 ? 'negative' : 'info', probability: 'medium', timeframe: '1+ weeks' },
    { title: result.longTermImpact.metabolicImpact, description: 'Metabolism and weight considerations', icon: 'flame-outline', severity: result.composition.sugarGrams > 10 ? 'warning' : 'info', probability: 'medium', timeframe: '1+ weeks' },
    { title: result.longTermImpact.riskAccumulation, description: 'Cumulative health effect', icon: 'shield-checkmark-outline', severity: timeImpact.longTerm.confidence > 0.8 ? 'info' : 'warning', probability: 'low', timeframe: '1+ weeks' },
    { title: result.longTermImpact.nutritionalBalance, description: 'Dietary integration guidance', icon: 'restaurant-outline', severity: 'info', probability: 'high', timeframe: '1+ weeks' },
  ], [result, timeImpact]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(heroScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();

    const interval = setInterval(() => {
      setTimeImpact(calculateTimeBasedImpact(result.impactScore, result.category));
    }, 30000);

    return () => clearInterval(interval);
  }, [result]);

  const handleShare = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const renderHeader = () => (
    <Animated.View
      style={[
        styles.header,
        { paddingTop: insets.top + THEME.spacing.lg },
        { opacity: headerOpacity }
      ]}
    >
      <TouchableOpacity
        style={styles.headerButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={24} color={THEME.colors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Scan Analysis</Text>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={handleShare}
      >
        <Ionicons name="share-outline" size={24} color={THEME.colors.text} />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderHeroCard = () => {
    const statusColor = STATUS_COLORS[result.status] || THEME.colors.info;
    const statusLabel = result.status.charAt(0).toUpperCase() + result.status.slice(1);

    return (
      <Animated.View style={[styles.heroCard, { transform: [{ scale: heroScale }] }]}>
        <LinearGradient
          colors={[THEME.colors.surfaceGlass, THEME.colors.surfaceElevated]}
          style={styles.heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroContent}>
            <ScoreRing score={result.impactScore} size={110} strokeWidth={14} />
            <View style={styles.heroText}>
              <Text style={styles.heroBrand}>{result.brand}</Text>
              <Text style={styles.heroName}>{result.detectedProduct}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>
          </View>
          <View style={styles.heroFooter}>
            <Text style={styles.heroServing}>Serving: {result.composition.servingSize}{result.composition.servingUnit}</Text>
            <Text style={styles.heroDisclaimer}>Values are AI estimates. Check product labeling for precise nutrition.</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      {renderHeader()}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + THEME.spacing.xxxx }]}
        showsVerticalScrollIndicator={false}
      >
        {renderHeroCard()}
        <GlassCard title="Nutrition Breakdown" accentColor={THEME.colors.primary}>
          {nutritionMetrics.map((metric, index) => (
            <NutritionBar key={metric.label} {...metric} delay={index * 100} />
          ))}
        </GlassCard>
        <GlassCard title="Additional Info" accentColor={THEME.colors.secondary}>
          {wellnessIndicators.map((indicator, index) => (
            <InfoRow key={indicator.label} {...indicator} />
          ))}
        </GlassCard>
        <GlassCard title="Key Ingredients" accentColor={THEME.colors.purple}>
          {result.composition.ingredients.slice(0, 5).map((ingredient, index) => (
            <IngredientItemComponent
              key={ingredient.name + index}
              ingredient={{
                ...ingredient,
                description: ingredient.description || `${ingredient.function} ingredient`
              }}
              index={index}
            />
          ))}
        </GlassCard>
        <GlassCard accentColor={THEME.colors.cyan}>
          <View style={styles.aiInsightHeader}>
            <Ionicons name="sparkles-outline" size={20} color={THEME.colors.secondary} />
            <Text style={styles.aiInsightTitle}>AI Wellness Insight</Text>
          </View>
          <Text style={styles.aiInsightText}>"{result.aiInsight}"</Text>
        </GlassCard>
        {result.alternatives && result.alternatives.length > 0 && (
          <GlassCard title="Healthier Alternatives" accentColor={THEME.colors.success}>
            {result.alternatives.slice(0, 3).map((alternative, index) => (
              <TouchableOpacity key={alternative} style={styles.alternativeRow}>
                <View style={styles.alternativeNumber}>
                  <Text style={styles.alternativeNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.alternativeText}>{alternative}</Text>
                <Ionicons name="chevron-forward-outline" size={16} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            ))}
          </GlassCard>
        )}
        <GlassCard title="Short-Term Effects" accentColor={THEME.colors.info}>
          {shortTermEffects.map((effect, index) => <EffectBullet key={index} effect={effect} index={index} />)}
        </GlassCard>
        <GlassCard title="Medium-Term Effects" accentColor={THEME.colors.warning}>
          {mediumTermEffects.map((effect, index) => <EffectBullet key={index} effect={effect} index={index} />)}
        </GlassCard>
        <GlassCard title="Long-Term Effects" accentColor={THEME.colors.purple}>
          {longTermEffects.map((effect, index) => <EffectBullet key={index} effect={effect} index={index} />)}
        </GlassCard>
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>Liquid Impact is for informational purposes only and does not constitute medical advice.</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: THEME.spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: THEME.spacing.lg, paddingBottom: THEME.spacing.md, backgroundColor: THEME.colors.surfaceGlass, borderBottomWidth: 1, borderBottomColor: THEME.colors.glassBorder },
  headerButton: { padding: THEME.spacing.sm, borderRadius: THEME.borderRadius.full },
  headerTitle: { ...THEME.typography.h3, color: THEME.colors.text },
  heroCard: { marginVertical: THEME.spacing.xxl, borderRadius: THEME.borderRadius.xxl, overflow: 'hidden' },
  heroGradient: { padding: THEME.spacing.xxl, borderRadius: THEME.borderRadius.xxl },
  heroContent: { alignItems: 'center', marginBottom: THEME.spacing.xl },
  heroText: { alignItems: 'center', marginTop: THEME.spacing.lg },
  heroBrand: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: THEME.spacing.xs },
  heroName: { ...THEME.typography.h2, color: THEME.colors.text, textAlign: 'center', marginBottom: THEME.spacing.md },
  statusBadge: { paddingHorizontal: THEME.spacing.md, paddingVertical: THEME.spacing.xs, borderRadius: THEME.borderRadius.full, borderWidth: 1 },
  statusText: { ...THEME.typography.label, fontSize: 11 },
  heroFooter: { alignItems: 'center', paddingTop: THEME.spacing.lg, borderTopWidth: 1, borderTopColor: THEME.colors.glassBorder },
  heroServing: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary, marginBottom: THEME.spacing.xs },
  heroDisclaimer: { ...THEME.typography.caption, color: THEME.colors.textMuted, textAlign: 'center', lineHeight: 16 },
  glassCard: { backgroundColor: THEME.colors.surfaceGlass, borderRadius: THEME.borderRadius.xl, marginBottom: THEME.spacing.xl, borderWidth: 1, borderColor: THEME.colors.glassBorder, overflow: 'hidden' },
  glassCardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  glassCardHeader: { padding: THEME.spacing.lg, paddingBottom: 0 },
  glassCardTitle: { ...THEME.typography.h4, color: THEME.colors.text, marginBottom: THEME.spacing.xs },
  glassCardSubtitle: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary },
  glassCardContent: { padding: THEME.spacing.lg },
  nutritionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: THEME.spacing.md },
  nutritionLabelContainer: { width: '35%', paddingRight: THEME.spacing.sm },
  nutritionLabel: { ...THEME.typography.bodySm, color: THEME.colors.text, fontWeight: '500' },
  nutritionDescription: { ...THEME.typography.bodyXs, color: THEME.colors.textMuted, marginTop: 2 },
  nutritionBarContainer: { flex: 1, paddingHorizontal: THEME.spacing.sm },
  nutritionBarTrack: { height: 8, backgroundColor: THEME.colors.border, borderRadius: 4, overflow: 'hidden' },
  nutritionBarFill: { height: '100%', borderRadius: 4 },
  nutritionValue: { ...THEME.typography.bodySm, color: THEME.colors.text, fontWeight: '600', width: 50, textAlign: 'right' },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: THEME.spacing.sm },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  infoRowIcon: { marginRight: THEME.spacing.xs },
  infoRowLabel: { ...THEME.typography.bodySm, color: THEME.colors.text },
  infoRowRight: { alignItems: 'flex-end' },
  infoRowValue: { ...THEME.typography.bodySm, fontWeight: '600' },
  infoRowDescription: { ...THEME.typography.bodyXs, color: THEME.colors.textMuted, marginTop: 2 },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: THEME.spacing.sm },
  ingredientDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.colors.primary, marginTop: 6, marginRight: THEME.spacing.sm },
  ingredientContent: { flex: 1, marginRight: THEME.spacing.sm },
  ingredientName: { ...THEME.typography.bodySm, color: THEME.colors.text, fontWeight: '500', marginBottom: 2 },
  ingredientDescription: { ...THEME.typography.bodyXs, color: THEME.colors.textSecondary, marginBottom: 2 },
  ingredientRole: { ...THEME.typography.bodyXs, color: THEME.colors.textMuted, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5 },
  riskBadge: { paddingHorizontal: THEME.spacing.xs, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  riskBadgeText: { ...THEME.typography.bodyXs, fontWeight: '600', fontSize: 10 },
  effectRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: THEME.spacing.sm },
  effectIcon: { marginTop: 2, marginRight: THEME.spacing.sm },
  effectContent: { flex: 1 },
  effectTitle: { ...THEME.typography.bodySm, color: THEME.colors.text, fontWeight: '500', marginBottom: 2 },
  effectDescription: { ...THEME.typography.bodyXs, color: THEME.colors.textSecondary, marginBottom: 2 },
  effectTimeframe: { ...THEME.typography.bodyXs, color: THEME.colors.textMuted },
  aiInsightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: THEME.spacing.md },
  aiInsightTitle: { ...THEME.typography.h4, color: THEME.colors.text, marginLeft: THEME.spacing.xs },
  aiInsightText: { ...THEME.typography.body, color: THEME.colors.textSecondary, fontStyle: 'italic', lineHeight: 24 },
  alternativeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: THEME.spacing.sm, paddingHorizontal: THEME.spacing.xs },
  alternativeNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: THEME.colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: THEME.spacing.md },
  alternativeNumberText: { ...THEME.typography.bodyXs, color: THEME.colors.primary, fontWeight: '600' },
  alternativeText: { ...THEME.typography.bodySm, color: THEME.colors.text, flex: 1 },
  disclaimer: { padding: THEME.spacing.lg, alignItems: 'center' },
  disclaimerText: { ...THEME.typography.caption, color: THEME.colors.textMuted, textAlign: 'center', lineHeight: 16 },
  scoreRingLabel: { position: 'absolute', alignItems: 'center' },
  scoreRingValue: { ...THEME.typography.h1, fontWeight: '700' },
  scoreRingUnit: { ...THEME.typography.bodyXs, color: THEME.colors.textMuted, marginTop: -4 },
});

export default LiquidImpactScanScreen;
