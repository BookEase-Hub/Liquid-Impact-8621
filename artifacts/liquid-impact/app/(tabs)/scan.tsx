// Premium scan screen — V2 UX with accessibility, animations, guidance overlay,
// skeleton loading and incremental pipeline messages.
// Architecture: uses existing AppContext + analyzeDrink service (no external store).

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useApp, SUBSCRIPTION_LIMITS } from '@/context/AppContext';
import { analyzeDrink } from '@/services/api';
import { GlassCard, ScoreRing } from '@/components/ui';
import type { ScanResult } from '@/types';

// ─── Local types ─────────────────────────────────────────────────────────────
type ScanMode = 'drink' | 'barcode' | 'ingredients';

type ScanPhase =
  | 'IDLE'
  | 'PREPARING'
  | 'VALIDATING_IMAGE'
  | 'EXTRACTING_BARCODE'
  | 'RUNNING_OCR'
  | 'DETECTING_PACKAGING'
  | 'MATCHING_PRODUCT'
  | 'ANALYZING_NUTRITION'
  | 'CALCULATING_IMPACT'
  | 'SUCCESS'
  | 'NEEDS_CORRECTION'
  | 'FAILED';

interface ImageQualityMetrics {
  issues: string[];
  labelVisibilityScore: number;
  overallConfidence: number;
  blurScore: number;
  lightScore: number;
  labelScore: number;
}

// ─── Theme ───────────────────────────────────────────────────────────────────
const C = {
  background: '#020617',
  backgroundSecondary: 'rgba(255,255,255,0.06)',
  foreground: '#ffffff',
  mutedForeground: 'rgba(255,255,255,0.7)',
  subtext: 'rgba(255,255,255,0.5)',
  primary: '#06b6d4',
  primaryDim: 'rgba(6,182,212,0.15)',
  secondary: '#8b5cf6',
  border: 'rgba(255,255,255,0.08)',
  borderActive: 'rgba(6,182,212,0.4)',
  scoreHigh: '#10b981',
  scoreMedium: '#f59e0b',
  scoreLow: '#ef4444',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  gradientStart: '#06b6d4',
  gradientEnd: '#8b5cf6',
  overlay: 'rgba(0,0,0,0.7)',
  cardBg: 'rgba(255,255,255,0.04)',
  skeleton: 'rgba(255,255,255,0.1)',
};

const getScoreColor = (score: number) =>
  score >= 80 ? C.scoreHigh : score >= 60 ? C.scoreMedium : C.scoreLow;

const getStatusLabel = (score: number) =>
  score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';

const getConfidenceConfig = (score: number) => {
  if (score >= 0.85) return { bg: `${C.scoreHigh}18`, border: `${C.scoreHigh}30`, text: C.scoreHigh, label: 'VERIFIED' };
  if (score >= 0.65) return { bg: `${C.scoreMedium}18`, border: `${C.scoreMedium}30`, text: C.scoreMedium, label: 'GOOD' };
  return { bg: `${C.scoreLow}18`, border: `${C.scoreLow}30`, text: C.scoreLow, label: 'REVIEW' };
};

// ─── ScanHeader ───────────────────────────────────────────────────────────────
const ScanHeader: React.FC<{ canScan: boolean; limitText: string }> = ({ canScan, limitText }) => {
  const router = useRouter();
  return (
    <View style={hdr.container}>
      <View style={hdr.textGroup}>
        <Text style={hdr.subtitle} accessibilityLabel="Feature description">AI-Powered Intelligence</Text>
        <Text style={hdr.title} accessibilityLabel="Screen title">Scan a Drink</Text>
        <Text style={[hdr.limit, { color: canScan ? C.subtext : C.warning }]} accessibilityLabel="Scan quota">
          {limitText}
        </Text>
      </View>
      {!canScan && (
        <TouchableOpacity
          onPress={() => router.push('/paywall')}
          style={hdr.upgradeBtn}
          accessibilityLabel="Upgrade to premium"
          accessibilityRole="button"
          accessibilityHint="Unlock unlimited scans and advanced features"
        >
          <LinearGradient colors={[C.gradientStart, C.gradientEnd]} style={hdr.upgradeGradient}>
            <Text style={hdr.upgradeText}>Upgrade</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};
const hdr = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  textGroup: { gap: 4 },
  subtitle: { fontSize: 13, fontWeight: '600', color: C.mutedForeground },
  title: { fontSize: 28, fontWeight: '800', color: C.foreground, lineHeight: 32 },
  limit: { fontSize: 12, fontWeight: '500', marginTop: 4 },
  upgradeBtn: { borderRadius: 14, overflow: 'hidden' },
  upgradeGradient: { paddingHorizontal: 16, paddingVertical: 10 },
  upgradeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

// ─── ScanModeToggle ───────────────────────────────────────────────────────────
const MODES: { value: ScanMode; label: string; icon: string; hint: string }[] = [
  { value: 'drink',       label: 'Drink',       icon: 'water',         hint: 'Scan any beverage bottle or glass' },
  { value: 'barcode',     label: 'Barcode',     icon: 'barcode',       hint: 'Scan product barcode for instant lookup' },
  { value: 'ingredients', label: 'Ingredients', icon: 'document-text', hint: 'Scan nutrition label for detailed analysis' },
];

const ScanModeToggle: React.FC<{ currentMode: ScanMode; onModeChange: (m: ScanMode) => void }> = ({
  currentMode, onModeChange,
}) => (
  <View style={mode.container} accessibilityLabel="Scan mode selection" accessibilityRole="tablist">
    {MODES.map((m) => (
      <TouchableOpacity
        key={m.value}
        onPress={() => { onModeChange(m.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        style={[mode.button, {
          backgroundColor: currentMode === m.value ? `${C.primary}20` : 'transparent',
          borderColor:      currentMode === m.value ? C.borderActive    : C.border,
        }]}
        accessibilityRole="tab"
        accessibilityState={{ selected: currentMode === m.value }}
        accessibilityLabel={m.label}
        accessibilityHint={m.hint}
      >
        <Ionicons name={m.icon as any} size={18} color={currentMode === m.value ? C.primary : C.mutedForeground} />
        <Text style={[mode.label, { color: currentMode === m.value ? C.primary : C.mutedForeground }]}>
          {m.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);
const mode = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 4, gap: 4, marginBottom: 20 },
  button: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 16, borderWidth: 1 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
});

// ─── ScanGuidanceOverlay ──────────────────────────────────────────────────────
const ScanGuidanceOverlay: React.FC<{ metrics: ImageQualityMetrics | null; scanMode: ScanMode }> = ({ metrics, scanMode }) => {
  const guidance = (() => {
    if (!metrics) return { message: 'Center the drink in the frame', color: C.mutedForeground };
    if (metrics.issues.includes('BLUR'))           return { message: '📱 Hold steady — image is blurry',  color: C.warning };
    if (metrics.issues.includes('LOW_LIGHT'))      return { message: '💡 Move to better lighting',         color: C.warning };
    if (metrics.issues.includes('OBSCURED_LABEL')) return { message: '🏷️ Ensure label is visible',         color: C.warning };
    if (metrics.labelVisibilityScore < 0.5)        return { message: '🔍 Move closer to the label',        color: C.primary };
    if (metrics.overallConfidence > 0.8)           return { message: '✅ Perfect — ready to scan',         color: C.success };
    return { message: scanMode === 'barcode' ? '📊 Align barcode in frame' : '🥤 Center the drink', color: C.mutedForeground };
  })();

  return (
    <View style={guide.container}>
      <View style={guide.frame}>
        <View style={[guide.corner, guide.topLeft]} />
        <View style={[guide.corner, guide.topRight]} />
        <View style={[guide.corner, guide.bottomLeft]} />
        <View style={[guide.corner, guide.bottomRight]} />
      </View>
      <View style={[guide.textBox, { backgroundColor: `${guidance.color}15` }]}>
        <Text style={[guide.text, { color: guidance.color }]}>{guidance.message}</Text>
      </View>
      <View style={guide.dots}>
        {(['blur', 'light', 'label'] as const).map((key) => {
          const score = metrics?.[`${key}Score` as keyof ImageQualityMetrics] as number | undefined;
          return (
            <View key={key} style={[guide.dot, { backgroundColor: score === undefined || score > 0.5 ? C.success : C.border }]} />
          );
        })}
      </View>
    </View>
  );
};
const guide = StyleSheet.create({
  container: { position: 'absolute', top: 80, left: 24, right: 24, alignItems: 'center', gap: 12, zIndex: 10 },
  frame: { width: '100%', aspectRatio: 1, maxWidth: 280, position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: C.primary, borderWidth: 2 },
  topLeft:     { top: 0,    left: 0,  borderTopLeftRadius: 16,     borderRightWidth: 0,  borderBottomWidth: 0 },
  topRight:    { top: 0,    right: 0, borderTopRightRadius: 16,    borderLeftWidth: 0,   borderBottomWidth: 0 },
  bottomLeft:  { bottom: 0, left: 0,  borderBottomLeftRadius: 16,  borderRightWidth: 0,  borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderBottomRightRadius: 16, borderLeftWidth: 0,   borderTopWidth: 0 },
  textBox: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  text: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

// ─── CaptureHero ─────────────────────────────────────────────────────────────
const CaptureHero: React.FC<{
  selectedImage: string | null;
  isProcessing: boolean;
  imageMetrics: ImageQualityMetrics | null;
  currentMode: ScanMode;
  onPickFromGallery: () => void;
  onPickFromCamera: () => void;
  onReset: () => void;
}> = ({ selectedImage, isProcessing, imageMetrics, currentMode, onPickFromGallery, onPickFromCamera, onReset }) => {
  if (!selectedImage) {
    return (
      <TouchableOpacity
        onPress={onPickFromGallery}
        activeOpacity={0.8}
        style={cap.placeholder}
        accessibilityLabel="Select image to scan"
        accessibilityRole="button"
        accessibilityHint="Tap to choose a photo from your gallery or take a new picture"
      >
        <LinearGradient colors={[C.gradientStart, C.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cap.icon}>
          <Ionicons name="camera" size={32} color="#fff" />
        </LinearGradient>
        <Text style={cap.title}>Take or select a photo</Text>
        <Text style={cap.hint}>Point at any drink — bottle, glass, or can — and let AI analyze it</Text>
        <View style={cap.badges}>
          <View style={cap.badge}>
            <Ionicons name="sparkles" size={12} color={C.primary} />
            <Text style={{ color: C.primary, fontSize: 11, fontWeight: '600' }}>AI-Powered</Text>
          </View>
          <View style={cap.badge}>
            <Ionicons name="shield-checkmark" size={12} color={C.success} />
            <Text style={{ color: C.success, fontSize: 11, fontWeight: '600' }}>Secure</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <TouchableOpacity
            onPress={onPickFromCamera}
            style={[cap.badge, { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: `${C.primary}30` }]}
            accessibilityLabel="Open camera"
            accessibilityRole="button"
          >
            <Ionicons name="camera" size={14} color={C.primary} />
            <Text style={{ color: C.primary, fontSize: 13, fontWeight: '700' }}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onPickFromGallery}
            style={[cap.badge, { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: `${C.secondary}30` }]}
            accessibilityLabel="Open gallery"
            accessibilityRole="button"
          >
            <Ionicons name="images" size={14} color={C.secondary} />
            <Text style={{ color: C.secondary, fontSize: 13, fontWeight: '700' }}>Gallery</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={cap.imageContainer}>
      <Image source={{ uri: selectedImage }} style={cap.image} resizeMode="cover"
        accessibilityLabel="Selected drink image" accessibilityHint="Image ready for AI analysis" />
      {!isProcessing && (
        <TouchableOpacity onPress={onReset} style={cap.closeButton} activeOpacity={0.8}
          accessibilityLabel="Remove image" accessibilityRole="button">
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      )}
      {!isProcessing && <ScanGuidanceOverlay metrics={imageMetrics} scanMode={currentMode} />}
      {isProcessing && (
        <View style={cap.overlay} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={cap.overlayText}>Analyzing...</Text>
        </View>
      )}
    </View>
  );
};
const cap = StyleSheet.create({
  placeholder: { height: 260, borderRadius: 28, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: C.cardBg, padding: 24, marginBottom: 16, borderColor: C.border },
  icon: { width: 72, height: 72, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: C.foreground, textAlign: 'center' },
  hint: { fontSize: 14, color: C.mutedForeground, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12 },
  imageContainer: { height: 260, borderRadius: 28, overflow: 'hidden', position: 'relative', marginBottom: 16 },
  image: { width: '100%', height: '100%' },
  closeButton: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: C.overlay, justifyContent: 'center', alignItems: 'center', gap: 12 },
  overlayText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

// ─── ProcessingView ───────────────────────────────────────────────────────────
const PHASE_MESSAGES: Record<ScanPhase, string> = {
  IDLE:               'Ready to scan',
  PREPARING:          'Initializing AI engine...',
  VALIDATING_IMAGE:   'Checking image quality...',
  EXTRACTING_BARCODE: '🔍 Detecting barcode...',
  RUNNING_OCR:        '📝 Reading label text...',
  DETECTING_PACKAGING:'🎨 Analyzing packaging...',
  MATCHING_PRODUCT:   '🔗 Matching product database...',
  ANALYZING_NUTRITION:'🥗 Calculating nutrition...',
  CALCULATING_IMPACT: '⚡ Generating health insights...',
  SUCCESS:            'Analysis complete!',
  NEEDS_CORRECTION:   'Review needed...',
  FAILED:             'Error occurred',
};

const ProcessingView: React.FC<{ phase: ScanPhase; onCancel: () => void }> = ({ phase, onCancel }) => {
  const scanLineAnim = useRef(new Animated.Value(-200));
  const ringPulseAnim = useRef(new Animated.Value(1));

  useEffect(() => {
    const lineAnim = Animated.loop(Animated.sequence([
      Animated.timing(scanLineAnim.current, { toValue: 200,  duration: 2000, useNativeDriver: true }),
      Animated.timing(scanLineAnim.current, { toValue: -200, duration: 2000, useNativeDriver: true }),
    ]));
    const ringAnim = Animated.loop(Animated.sequence([
      Animated.timing(ringPulseAnim.current, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
      Animated.timing(ringPulseAnim.current, { toValue: 1,    duration: 1000, useNativeDriver: true }),
    ]));
    lineAnim.start();
    ringAnim.start();
    return () => { lineAnim.stop(); ringAnim.stop(); };
  }, []);

  return (
    <View style={proc.container}>
      <LinearGradient colors={['rgba(6,182,212,0.1)', 'rgba(139,92,246,0.05)']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[proc.ring, { transform: [{ scale: ringPulseAnim.current }] }]}>
        <View style={proc.cTL} /><View style={proc.cTR} />
        <View style={proc.cBL} /><View style={proc.cBR} />
        <Animated.View style={[proc.scanLine, { transform: [{ translateY: scanLineAnim.current }] }]} />
      </Animated.View>
      <View style={proc.content}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={proc.title} accessibilityLiveRegion="polite">{PHASE_MESSAGES[phase]}</Text>
        <Text style={proc.subtitle}>
          {phase === 'VALIDATING_IMAGE' ? 'Ensuring optimal clarity for accurate results' :
           phase === 'MATCHING_PRODUCT' ? 'Searching 50,000+ products in our database' :
           'AI is working on your scan'}
        </Text>
      </View>
      <TouchableOpacity onPress={onCancel} style={proc.cancel} activeOpacity={0.7}
        accessibilityLabel="Cancel scan" accessibilityRole="button">
        <Text style={proc.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
};
const proc = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center' },
  ring: { width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: 'rgba(6,182,212,0.3)', justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  cTL: { position: 'absolute', top: -2,    left: -2,  width: 32, height: 32, borderTopWidth: 3,    borderLeftWidth: 3,  borderColor: C.primary, borderTopLeftRadius: 20 },
  cTR: { position: 'absolute', top: -2,    right: -2, width: 32, height: 32, borderTopWidth: 3,    borderRightWidth: 3, borderColor: C.primary, borderTopRightRadius: 20 },
  cBL: { position: 'absolute', bottom: -2, left: -2,  width: 32, height: 32, borderBottomWidth: 3, borderLeftWidth: 3,  borderColor: C.primary, borderBottomLeftRadius: 20 },
  cBR: { position: 'absolute', bottom: -2, right: -2, width: 32, height: 32, borderBottomWidth: 3, borderRightWidth: 3, borderColor: C.primary, borderBottomRightRadius: 20 },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: C.primary },
  content: { alignItems: 'center', gap: 16 },
  title: { fontSize: 18, fontWeight: '700', color: C.foreground, textAlign: 'center' },
  subtitle: { fontSize: 14, color: C.mutedForeground, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  cancel: { position: 'absolute', bottom: 40, paddingVertical: 12, paddingHorizontal: 24 },
  cancelText: { color: C.subtext, fontSize: 14, fontWeight: '600' },
});

// ─── ResultSkeleton ───────────────────────────────────────────────────────────
const ResultSkeleton: React.FC = () => (
  <GlassCard style={skel.card}>
    <View style={skel.header}>
      <View style={[skel.circle, { width: 110, height: 110 }]} />
      <View style={skel.productInfo}>
        <View style={[skel.line, { width: 120, height: 24 }]} />
        <View style={[skel.line, { width: 80, height: 16 }]} />
        <View style={skel.badgeRow}>
          <View style={[skel.badge, { width: 80 }]} />
          <View style={[skel.badge, { width: 70 }]} />
        </View>
      </View>
    </View>
    <View style={skel.insightBox}>
      <View style={[skel.line, { width: '80%', height: 16 }]} />
    </View>
    <View style={skel.statsGrid}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={skel.statItem}>
          <View style={[skel.circle, { width: 18, height: 18 }]} />
          <View style={[skel.line, { width: 40, height: 16 }]} />
          <View style={[skel.line, { width: 50, height: 10 }]} />
        </View>
      ))}
    </View>
  </GlassCard>
);
const skel = StyleSheet.create({
  card: { borderRadius: 28, padding: 24, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  productInfo: { alignItems: 'center', gap: 6, flex: 1 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  circle: { borderRadius: 999, backgroundColor: C.skeleton },
  line: { borderRadius: 4, backgroundColor: C.skeleton },
  badge: { height: 24, borderRadius: 10, backgroundColor: C.skeleton },
  insightBox: { padding: 14, backgroundColor: 'rgba(6,182,212,0.1)', borderRadius: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: { width: '47%', alignItems: 'center', gap: 6, padding: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16 },
});

// ─── ErrorView ────────────────────────────────────────────────────────────────
const ErrorView: React.FC<{ message: string; onRetry: () => void; onGoBack: () => void }> = ({ message, onRetry, onGoBack }) => (
  <View style={[err.container, { backgroundColor: C.background }]}>
    <View style={[err.card, { backgroundColor: `${C.danger}10`, borderColor: `${C.danger}30` }]}>
      <View style={err.iconBox}>
        <Ionicons name="alert-circle" size={32} color={C.danger} />
      </View>
      <Text style={[err.title, { color: C.foreground }]}>Scan Failed</Text>
      <Text style={[err.message, { color: C.mutedForeground }]}>{message}</Text>
      <View style={err.actions}>
        <TouchableOpacity onPress={onRetry} style={[err.button, { backgroundColor: C.primary }]}
          accessibilityLabel="Retry scan" accessibilityRole="button">
          <Text style={err.btnText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onGoBack}
          style={[err.button, { backgroundColor: C.backgroundSecondary, borderWidth: 1, borderColor: C.border }]}
          accessibilityLabel="Go back" accessibilityRole="button">
          <Text style={[err.btnText, { color: C.foreground }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);
const err = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: { borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1 },
  iconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: `${C.danger}15`, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  actions: { flexDirection: 'row', gap: 12, width: '100%' },
  button: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

// ─── StatsGrid ────────────────────────────────────────────────────────────────
const StatsGrid: React.FC<{ calories: number; sugar: number; hydration: number; caffeine: number }> = ({ calories, sugar, hydration, caffeine }) => {
  const stats = [
    { label: 'Calories',  value: `${calories}`,    icon: 'flame',     color: C.scoreMedium },
    { label: 'Sugar',     value: `${sugar}g`,      icon: 'nutrition', color: C.scoreLow },
    { label: 'Hydration', value: `${hydration}%`,  icon: 'water',     color: C.primary },
    { label: 'Caffeine',  value: `${caffeine}mg`,  icon: 'flash',     color: C.secondary },
  ];
  return (
    <View style={stats2.container} accessibilityLabel="Nutrition summary">
      {stats.map((s) => (
        <View key={s.label} style={stats2.item}>
          <Ionicons name={s.icon as any} size={18} color={s.color} />
          <Text style={[stats2.value, { color: C.foreground }]}>{s.value}</Text>
          <Text style={[stats2.label, { color: C.mutedForeground }]}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
};
const stats2 = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  item: { width: '47%', alignItems: 'center', gap: 6, padding: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, borderWidth: 1, borderColor: C.border },
  value: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 10 },
});

// ─── AlternativesBox ──────────────────────────────────────────────────────────
const AlternativesBox: React.FC<{ alternatives: string[] }> = ({ alternatives }) => (
  <View style={alt.container}>
    <Text style={[alt.title, { color: C.foreground }]}>💡 Healthier Options</Text>
    <View style={alt.list}>
      {alternatives.slice(0, 2).map((a, i) => (
        <View key={i} style={alt.item}>
          <View style={alt.dot} />
          <Text style={[alt.text, { color: C.foreground }]}>{a}</Text>
        </View>
      ))}
    </View>
  </View>
);
const alt = StyleSheet.create({
  container: { padding: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, borderWidth: 1, borderColor: C.border, gap: 10 },
  title: { fontSize: 14, fontWeight: '700' },
  list: { gap: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.scoreHigh },
  text: { fontSize: 13 },
});

// ─── ResultCard (maps to existing ScanResult shape) ───────────────────────────
const ResultCard: React.FC<{ result: ScanResult; onReset: () => void }> = ({ result, onReset }) => {
  const router = useRouter();
  const scoreColor = getScoreColor(result.impactScore);
  const confCfg = getConfidenceConfig(result.confidenceScore ?? 0.75);

  return (
    <GlassCard style={{ ...res.card, borderColor: `${scoreColor}30` }}>
      <View style={res.header}>
        <ScoreRing score={result.impactScore} size={110} strokeWidth={10} />
        <View style={res.productInfo}>
          <Text style={[res.productName, { color: C.foreground }]}>{result.detectedProduct}</Text>
          {result.brand ? <Text style={[res.productBrand, { color: C.mutedForeground }]}>{result.brand}</Text> : null}
          <View style={res.badgeRow}>
            <View style={[res.badge, { backgroundColor: `${scoreColor}18`, borderColor: `${scoreColor}30` }]}>
              <Text style={[res.badgeText, { color: scoreColor }]}>{getStatusLabel(result.impactScore)}</Text>
            </View>
            <View style={[res.badge, { backgroundColor: confCfg.bg, borderColor: confCfg.border }]}>
              <Text style={[res.badgeText, { color: confCfg.text }]}>{confCfg.label}</Text>
            </View>
          </View>
        </View>
      </View>

      {result.aiInsight ? (
        <View style={res.insightBox}>
          <Ionicons name="sparkles" size={16} color={C.primary} />
          <Text style={[res.insightText, { color: C.subtext }]}>{result.aiInsight}</Text>
        </View>
      ) : null}

      <StatsGrid
        calories={result.composition.calories}
        sugar={result.composition.sugarGrams}
        hydration={result.hydrationLevel}
        caffeine={result.composition.caffeineMg}
      />

      {result.alternatives && result.alternatives.length > 0 && (
        <AlternativesBox alternatives={result.alternatives} />
      )}

      <TouchableOpacity
        onPress={() => router.push(`/report?id=${result.id}`)}
        activeOpacity={0.9}
        style={res.reportButton}
        accessibilityLabel="View detailed report"
        accessibilityRole="button"
        accessibilityHint="See full nutrition facts, ingredients, and health insights"
      >
        <LinearGradient colors={[C.gradientStart, C.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={res.reportGradient}>
          <Text style={res.reportText}>View Full Report</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={onReset} style={res.resetButton}
        accessibilityLabel="Scan another drink" accessibilityRole="button">
        <Text style={[res.resetText, { color: C.mutedForeground }]}>Scan Another Drink</Text>
      </TouchableOpacity>
    </GlassCard>
  );
};
const res = StyleSheet.create({
  card: { borderRadius: 28, padding: 24, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  productInfo: { alignItems: 'center', gap: 6, flex: 1 },
  productName: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  productBrand: { fontSize: 14 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  insightBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, backgroundColor: 'rgba(6,182,212,0.1)', borderRadius: 16 },
  insightText: { flex: 1, fontSize: 14, lineHeight: 20 },
  reportButton: { borderRadius: 20, overflow: 'hidden', marginTop: 8 },
  reportGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  reportText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resetButton: { alignItems: 'center', paddingVertical: 8 },
  resetText: { fontSize: 14, fontWeight: '600' },
});

// ─── PremiumInfoCard ──────────────────────────────────────────────────────────
const PremiumInfoCard: React.FC = () => (
  <View style={[info.container, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
    <Text style={[info.title, { color: C.foreground }]}>🔍 How Premium Scan Works</Text>
    <View style={info.list}>
      <Text style={[info.item, { color: C.mutedForeground }]}>• Prioritizes <Text style={{ color: C.primary }}>labels & packaging</Text> over liquid colour</Text>
      <Text style={[info.item, { color: C.mutedForeground }]}>• Multi-signal detection: barcode + OCR + visual features</Text>
      <Text style={[info.item, { color: C.mutedForeground }]}>• Weighted confidence scoring for reliable results</Text>
      <Text style={[info.item, { color: C.mutedForeground }]}>• Corrections improve AI accuracy over time</Text>
    </View>
  </View>
);
const info = StyleSheet.create({
  container: { padding: 16, borderRadius: 20, borderWidth: 1, marginTop: 8 },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  list: { gap: 6 },
  item: { fontSize: 13, lineHeight: 18 },
});

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function ScanScreen() {
  const { canScan, scanLimitMessage, todayScanCount, monthScanCount, addScan, state } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const limits = SUBSCRIPTION_LIMITS[state.subscription];

  const limitText = useMemo(() => {
    if (state.subscription === 'free') return `${todayScanCount}/${limits.daily} free scans today`;
    if (state.subscription === 'starter') return `${monthScanCount}/${limits.monthly} scans this month`;
    return 'Unlimited scans';
  }, [state.subscription, todayScanCount, monthScanCount, limits]);

  // ── Local state (replaces external store) ──────────────────────────────────
  const [scanMode, setScanMode] = useState<ScanMode>('drink');
  const [phase, setPhase] = useState<ScanPhase>('IDLE');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [imageMetrics] = useState<ImageQualityMetrics | null>(null);

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const isProcessing = phase !== 'IDLE' && phase !== 'SUCCESS' && phase !== 'FAILED';

  // ── Liquid warning ─────────────────────────────────────────────────────────
  const liquidWarning = useMemo(() => {
    if (!result?.liquidType || result.liquidType === 'beverage' || result.liquidType === 'alcohol' || result.liquidType === 'supplement') return null;
    const warnings: Record<string, { message: string; color: string; icon: string }> = {
      cooking_oil: { message: 'This is a cooking oil — not meant for direct consumption.', color: C.warning, icon: 'warning' },
      condiment:   { message: 'This appears to be a condiment, not a beverage.',           color: C.warning, icon: 'information-circle' },
      other:       { message: "This doesn't appear to be a typical beverage.",             color: C.danger,  icon: 'alert-circle' },
    };
    return warnings[result.liquidType] ?? null;
  }, [result?.liquidType]);

  // ── Simulated pipeline phase sequencing during analysis ───────────────────
  const runPipelineSimulation = useCallback((abort: AbortController) => {
    const sequence: ScanPhase[] = [
      'PREPARING', 'VALIDATING_IMAGE', 'DETECTING_PACKAGING',
      'MATCHING_PRODUCT', 'ANALYZING_NUTRITION', 'CALCULATING_IMPACT',
    ];
    let i = 0;
    const tick = () => {
      if (abort.signal.aborted || !isMountedRef.current) return;
      if (i < sequence.length) {
        setPhase(sequence[i++]);
        setTimeout(tick, 700);
      }
    };
    tick();
  }, []);

  // ── Start analysis ─────────────────────────────────────────────────────────
  const handleStartScan = useCallback(async (imageUri: string, base64?: string) => {
    if (!canScan) {
      Alert.alert('Scan Limit Reached', scanLimitMessage || 'Upgrade to continue scanning.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => router.push('/paywall') },
      ]);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase('PREPARING');
    setErrorMsg('');
    setResult(null);

    runPipelineSimulation(controller);

    try {
      const raw = base64 ?? imageUri;
      // Strip the data URL prefix if present — API expects raw base64
      const b64 = raw.startsWith('data:') ? raw.split(',')[1] : raw;
      const scanResult = await analyzeDrink(b64);

      if (controller.signal.aborted || !isMountedRef.current) return;

      addScan(scanResult);
      setResult(scanResult);
      setPhase('SUCCESS');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      if (controller.signal.aborted) return;
      setPhase('FAILED');
      setErrorMsg(e instanceof Error ? e.message : 'Failed to analyze image');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [canScan, scanLimitMessage, addScan, router, runPipelineSimulation]);

  // ── Pick image ─────────────────────────────────────────────────────────────
  const pickImage = useCallback(async (useCamera: boolean) => {
    await Haptics.selectionAsync();
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Camera access is needed to scan drinks.');
          return;
        }
      }
      const isLowEnd = Platform.OS === 'android' && Number(Platform.Version) < 29;
      const quality = isLowEnd ? 0.7 : 0.85;

      const picked = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality, base64: true, allowsEditing: true, aspect: [4, 3] })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality, base64: true, allowsEditing: true, aspect: [4, 3] });

      if (!picked.canceled && picked.assets[0]) {
        const asset = picked.assets[0];
        setSelectedImage(asset.uri);
        setResult(null);
        setPhase('IDLE');
        setTimeout(() => {
          const b64 = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined;
          handleStartScan(asset.uri, b64);
        }, 300);
      }
    } catch {
      Alert.alert('Error', 'Could not access camera or gallery.');
    }
  }, [handleStartScan]);

  const handleReset = useCallback(() => {
    abortControllerRef.current?.abort();
    setSelectedImage(null);
    setResult(null);
    setPhase('IDLE');
    setErrorMsg('');
    Haptics.selectionAsync();
  }, []);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setPhase('IDLE');
  }, []);

  // ── Render: full-screen processing ────────────────────────────────────────
  if (isProcessing && !selectedImage) {
    return <ProcessingView phase={phase} onCancel={handleCancel} />;
  }

  // ── Render: full-screen error (no image) ─────────────────────────────────
  if (phase === 'FAILED' && errorMsg && !selectedImage) {
    return <ErrorView message={errorMsg} onRetry={handleReset} onGoBack={handleReset} />;
  }

  // ── Render: main scroll flow ──────────────────────────────────────────────
  return (
    <ScrollView
      style={[scr.container, { backgroundColor: C.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 24,
        gap: 20,
      }}
      accessibilityLabel="Drink scanner"
    >
      <ScanHeader canScan={canScan} limitText={limitText} />

      <ScanModeToggle currentMode={scanMode} onModeChange={setScanMode} />

      <CaptureHero
        selectedImage={selectedImage}
        isProcessing={isProcessing}
        imageMetrics={imageMetrics}
        currentMode={scanMode}
        onPickFromGallery={() => pickImage(false)}
        onPickFromCamera={() => pickImage(true)}
        onReset={handleReset}
      />

      {/* Manual analyse trigger (if user dismissed auto-scan) */}
      {selectedImage && !isProcessing && phase !== 'SUCCESS' && (
        <TouchableOpacity
          onPress={() => handleStartScan(selectedImage)}
          activeOpacity={0.9}
          style={scr.analyzeButton}
          accessibilityLabel="Start AI analysis"
          accessibilityRole="button"
          accessibilityHint="Analyze the selected drink image with artificial intelligence"
        >
          <Text style={scr.analyzeText}>✨ Analyze with AI</Text>
        </TouchableOpacity>
      )}

      {/* Non-beverage warning */}
      {liquidWarning && (
        <View
          style={[scr.warningBanner, { backgroundColor: `${liquidWarning.color}14`, borderColor: `${liquidWarning.color}30` }]}
          accessibilityRole="alert"
        >
          <Ionicons name={liquidWarning.icon as any} size={18} color={liquidWarning.color} />
          <Text style={[scr.warningText, { color: liquidWarning.color }]}>{liquidWarning.message}</Text>
        </View>
      )}

      {/* Skeleton while processing, then real result */}
      {isProcessing && selectedImage ? (
        <ResultSkeleton />
      ) : result ? (
        <ResultCard result={result} onReset={handleReset} />
      ) : phase === 'FAILED' && errorMsg ? (
        <View style={[scr.warningBanner, { backgroundColor: `${C.danger}14`, borderColor: `${C.danger}30` }]}>
          <Ionicons name="alert-circle" size={18} color={C.danger} />
          <Text style={[scr.warningText, { color: C.danger }]}>{errorMsg}</Text>
        </View>
      ) : null}

      <PremiumInfoCard />
    </ScrollView>
  );
}

const scr = StyleSheet.create({
  container: { flex: 1 },
  analyzeButton: {
    backgroundColor: C.primary,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  analyzeText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  warningText: { fontSize: 13, fontWeight: '600', flex: 1 },
});
