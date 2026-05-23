import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Dimensions, Platform, StatusBar, Animated,
  Easing, SafeAreaView, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createMMKV } from 'react-native-mmkv';
import Fuse from 'fuse.js';
import DRINK_DATABASE from '@/constants/drink-database';
import { useApp } from '@/context/AppContext';
import { analyzeDrink } from '@/services/api';
import { GlassCard, ScoreRing } from '@/components/ui';
import type { ScanResult, ScanStatus } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const storage = createMMKV({ id: 'liquid-impact-scan-cache-v2' });

const THEME = {
  background: '#020617',
  primary: '#06b6d4',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.65)',
  glass: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.1)',
};

// ─── Staged loading messages ──────────────────────────────────────────────────
const LOADING_STAGES = [
  { progress: 0.08, message: 'Drink detected', sub: 'Scanning label...' },
  { progress: 0.25, message: 'Reading ingredients', sub: 'Extracting nutritional data...' },
  { progress: 0.50, message: 'Calculating impact', sub: 'Analysing health effects...' },
  { progress: 0.75, message: 'Almost ready', sub: 'Generating insights...' },
  { progress: 0.92, message: 'Finalising results', sub: 'Preparing your score...' },
];

const getStatusColor = (status: ScanStatus) => {
  switch (status) {
    case 'optimal': return THEME.success;
    case 'stable': return THEME.warning;
    case 'risky': return '#f97316';
    case 'damaging': return THEME.danger;
    default: return THEME.primary;
  }
};

// ─── Fuse.js fuzzy search ─────────────────────────────────────────────────────
const fuseInstance = new Fuse(Object.values(DRINK_DATABASE), {
  keys: ['detectedProduct', 'brand'],
  threshold: 0.35,
  includeScore: true,
});

// ─── Scan Pipeline Hook ───────────────────────────────────────────────────────
type Phase = 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR';

function useScanPipeline() {
  const { addScan, canScan } = useApp();
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const isRunning = useRef(false);
  const stageTimer = useRef<any>(null);

  const advanceStages = useCallback(() => {
    let idx = 0;
    const tick = () => {
      if (idx >= LOADING_STAGES.length - 1) return;
      idx++;
      setStageIdx(idx);
      setProgress(LOADING_STAGES[idx].progress);
      const delay = idx === 1 ? 800 : idx === 2 ? 900 : idx === 3 ? 1100 : 1300;
      stageTimer.current = setTimeout(tick, delay);
    };
    stageTimer.current = setTimeout(tick, 300);
  }, []);

  const stopStages = useCallback(() => {
    if (stageTimer.current) clearTimeout(stageTimer.current);
  }, []);

  const executePipeline = useCallback(async (input: {
    barcode?: string;
    imageUri?: string;
    text?: string;
  }) => {
    if (isRunning.current) return;
    if (!canScan) {
      Alert.alert('Daily Limit Reached', 'Upgrade your plan to continue scanning.', [{ text: 'OK' }]);
      return;
    }

    isRunning.current = true;
    setPhase('PROCESSING');
    setProgress(LOADING_STAGES[0].progress);
    setStageIdx(0);
    setError(null);
    setResult(null);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    advanceStages();

    try {
      // ── Layer 0: MMKV device cache (instant) ─────────────────────────────
      const cacheKey = input.barcode
        ? `barcode_${input.barcode}`
        : input.text
          ? `text_${input.text.toLowerCase().slice(0, 40)}`
          : null;

      if (cacheKey) {
        const raw = storage.getString(`cache_${cacheKey}`);
        if (raw) {
          const cached = JSON.parse(raw) as ScanResult;
          stopStages();
          setProgress(1);
          addScan(cached);
          setResult(cached);
          setPhase('SUCCESS');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          isRunning.current = false;
          return;
        }
      }

      // ── Layer 1: Local drink database (fuzzy match, <5ms) ─────────────────
      if (input.barcode && DRINK_DATABASE[input.barcode]) {
        const match = DRINK_DATABASE[input.barcode];
        if (cacheKey) storage.set(`cache_${cacheKey}`, JSON.stringify(match));
        stopStages();
        setProgress(1);
        addScan(match);
        setResult(match);
        setPhase('SUCCESS');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        isRunning.current = false;
        return;
      }

      if (input.text && input.text.trim().length > 2) {
        const fuzzy = fuseInstance.search(input.text);
        if (fuzzy.length > 0 && (fuzzy[0].score ?? 1) < 0.25) {
          const match = fuzzy[0].item;
          if (cacheKey) storage.set(`cache_${cacheKey}`, JSON.stringify(match));
          stopStages();
          setProgress(1);
          addScan(match);
          setResult(match);
          setPhase('SUCCESS');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          isRunning.current = false;
          return;
        }
      }

      // ── Layer 2: AI Vision (Gemini → OpenAI fallback) ────────────────────
      if (!input.imageUri && !input.text) {
        throw new Error('No image or text provided for analysis.');
      }

      let base64: string | undefined;
      let productHint: string | undefined = input.text;

      if (input.imageUri) {
        // Aggressive compression: 512px, 0.65 quality — fastest upload
        const manipulated = await ImageManipulator.manipulateAsync(
          input.imageUri,
          [{ resize: { width: 512 } }],
          { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        base64 = manipulated.base64 ?? undefined;
      }

      if (!base64 && !productHint) {
        throw new Error('Could not process image. Please try again.');
      }

      const aiResult = await analyzeDrink(base64 ?? '', productHint);

      // Cache the AI result
      if (cacheKey) storage.set(`cache_${cacheKey}`, JSON.stringify(aiResult));

      stopStages();
      setProgress(1);
      addScan(aiResult);
      setResult(aiResult);
      setPhase('SUCCESS');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      stopStages();
      setError(err.message || 'Analysis failed. Please try again.');
      setPhase('ERROR');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      isRunning.current = false;
    }
  }, [canScan, addScan, advanceStages, stopStages]);

  const reset = useCallback(() => {
    stopStages();
    setPhase('IDLE');
    setResult(null);
    setError(null);
    setProgress(0);
    setStageIdx(0);
    isRunning.current = false;
  }, [stopStages]);

  return { phase, result, error, progress, stageIdx, executePipeline, reset };
}

// ─── Processing Screen ────────────────────────────────────────────────────────
function ProcessingScreen({ progress, stageIdx }: { progress: number; stageIdx: number }) {
  const scanLineAnim = useRef(new Animated.Value(-80)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 80, duration: 1200, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(scanLineAnim, { toValue: -80, duration: 1200, useNativeDriver: true, easing: Easing.linear }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
      easing: Easing.out(Easing.quad),
    }).start();
  }, [progress]);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 300, useNativeDriver: true,
    }).start();
  }, [stageIdx]);

  const stage = LOADING_STAGES[stageIdx] ?? LOADING_STAGES[0];
  const barWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.processingContainer}>
      <LinearGradient
        colors={['#020617', '#0a1628', '#020617']}
        style={StyleSheet.absoluteFill}
      />

      {/* Scanner animation */}
      <View style={styles.scannerBox}>
        <View style={[styles.scanCorner, styles.tl]} />
        <View style={[styles.scanCorner, styles.tr]} />
        <View style={[styles.scanCorner, styles.bl]} />
        <View style={[styles.scanCorner, styles.br]} />
        <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineAnim }] }]} />
      </View>

      {/* Stage message */}
      <Animated.View style={[styles.stageContainer, { opacity: fadeAnim }]}>
        <Text style={styles.stageMessage}>{stage.message}</Text>
        <Text style={styles.stageSub}>{stage.sub}</Text>
      </Animated.View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: barWidth }]} />
      </View>

      <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
    </View>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────
function ResultsScreen({ result, onReset }: { result: ScanResult; onReset: () => void }) {
  const statusColor = getStatusColor(result.status);

  return (
    <ScrollView style={styles.resultContainer} contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.resultHeader}>
        <TouchableOpacity onPress={onReset} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Results</Text>
        <TouchableOpacity style={styles.backBtn}>
          <Ionicons name="share-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Score card */}
      <GlassCard style={styles.mainCard}>
        <View style={styles.scoreRow}>
          <ScoreRing score={result.impactScore} size={120} strokeWidth={12} />
          <View style={styles.mainMeta}>
            <Text style={styles.productName}>{result.detectedProduct}</Text>
            {result.brand ? <Text style={styles.brandName}>{result.brand}</Text> : null}
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{result.status.toUpperCase()}</Text>
            </View>
            {result.confidenceScore >= 0.85 ? (
              <Text style={styles.confidenceTag}>High confidence</Text>
            ) : result.confidenceScore >= 0.65 ? (
              <Text style={[styles.confidenceTag, { color: THEME.warning }]}>Estimated match</Text>
            ) : (
              <Text style={[styles.confidenceTag, { color: THEME.textMuted }]}>Low confidence</Text>
            )}
          </View>
        </View>

        {result.viralStatement ? (
          <View style={styles.viralBox}>
            <Ionicons name="flash" size={14} color={THEME.primary} />
            <Text style={styles.viralText}>{result.viralStatement}</Text>
          </View>
        ) : null}

        <View style={styles.insightBox}>
          <Ionicons name="sparkles" size={16} color={THEME.primary} style={{ marginTop: 2 }} />
          <Text style={styles.insightText}>{result.aiInsight}</Text>
        </View>
      </GlassCard>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        {[
          { label: 'Sugar', value: `${result.composition.sugarGrams}g`, icon: 'nutrition', color: result.composition.sugarGrams > 25 ? THEME.danger : THEME.success },
          { label: 'Hydration', value: `${result.hydrationLevel}%`, icon: 'water', color: result.hydrationLevel >= 70 ? THEME.success : THEME.warning },
          { label: 'Calories', value: `${result.composition.calories}`, icon: 'flame', color: THEME.warning },
          { label: 'Caffeine', value: `${result.composition.caffeineMg}mg`, icon: 'lightning-bolt', color: result.composition.caffeineMg > 100 ? THEME.danger : THEME.primary },
        ].map((stat) => (
          <GlassCard key={stat.label} style={styles.statBox}>
            <MaterialCommunityIcons name={stat.icon as any} size={22} color={stat.color} />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </GlassCard>
        ))}
      </View>

      {/* Impact details */}
      <Text style={styles.sectionTitle}>Impact Analysis</Text>
      <GlassCard style={styles.impactCard}>
        <ImpactRow icon="flash" label="Energy" text={result.shortTermImpact.energyResponse} />
        <ImpactRow icon="water" label="Hydration" text={result.shortTermImpact.hydrationImpact} />
        <ImpactRow icon="chart-line" label="Long Term" text={result.longTermImpact.healthTrend} />
        <ImpactRow icon="bed" label="Sleep" text={result.mediumTermImpact.sleepQuality} />
      </GlassCard>

      {/* Alternatives */}
      {result.alternatives && result.alternatives.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Healthier Alternatives</Text>
          <View style={styles.altRow}>
            {result.alternatives.map((alt, i) => (
              <GlassCard key={i} style={styles.altCard}>
                <Ionicons name="leaf" size={14} color={THEME.success} />
                <Text style={styles.altText}>{alt}</Text>
              </GlassCard>
            ))}
          </View>
        </>
      )}

      {/* CTA */}
      <TouchableOpacity onPress={onReset} activeOpacity={0.85} style={{ marginBottom: 40 }}>
        <LinearGradient colors={[THEME.primary, THEME.secondary]} style={styles.ctaBtn}>
          <Ionicons name="camera" size={20} color="#fff" />
          <Text style={styles.ctaText}>Scan Another Drink</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const ImpactRow = ({ icon, label, text }: { icon: string; label: string; text: string }) => (
  <View style={styles.impactRow}>
    <View style={styles.impactIcon}>
      <MaterialCommunityIcons name={icon as any} size={18} color={THEME.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.impactLabel}>{label}</Text>
      <Text style={styles.impactText}>{text}</Text>
    </View>
  </View>
);

// ─── Main Scan Screen ─────────────────────────────────────────────────────────
export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [searchQuery, setSearchQuery] = useState('');
  const cameraRef = useRef<CameraView>(null);
  const { phase, result, error, progress, stageIdx, executePipeline, reset } = useScanPipeline();

  const handleBarcodeScanned = useCallback((res: BarcodeScanningResult) => {
    if (phase === 'IDLE') {
      executePipeline({ barcode: res.data });
    }
  }, [phase, executePipeline]);

  const handleCapture = useCallback(async () => {
    if (phase !== 'IDLE' || !cameraRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
        skipProcessing: true,
      });
      if (photo?.uri) {
        executePipeline({ imageUri: photo.uri });
      }
    } catch {
      executePipeline({});
    }
  }, [phase, executePipeline]);

  const pickFromGallery = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      executePipeline({ imageUri: res.assets[0].uri });
    }
  }, [executePipeline]);

  const handleManualSearch = useCallback(() => {
    if (searchQuery.trim().length < 2) return;
    executePipeline({ text: searchQuery.trim() });
  }, [searchQuery, executePipeline]);

  // ── Permission screen ──────────────────────────────────────────────────────
  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#06b6d4', '#8b5cf6']} style={styles.permIcon}>
          <Ionicons name="camera" size={40} color="#fff" />
        </LinearGradient>
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSub}>We need your camera to scan beverage labels and barcodes instantly.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Processing ─────────────────────────────────────────────────────────────
  if (phase === 'PROCESSING') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ProcessingScreen progress={progress} stageIdx={stageIdx} />
      </SafeAreaView>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────
  if (phase === 'SUCCESS' && result) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ResultsScreen result={result} onReset={reset} />
      </SafeAreaView>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (phase === 'ERROR') {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="alert-circle" size={64} color={THEME.danger} />
        <Text style={styles.permTitle}>Analysis Failed</Text>
        <Text style={styles.permSub}>{error}</Text>
        <TouchableOpacity style={[styles.permBtn, { backgroundColor: THEME.danger }]} onPress={reset}>
          <Text style={styles.permBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Camera / Manual ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {scanMode === 'camera' ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={cameraType}
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: THEME.background }]} />
      )}

      <BlurView intensity={scanMode === 'manual' ? 80 : 15} tint="dark" style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setCameraType(c => c === 'back' ? 'front' : 'back')}>
          <Ionicons name="camera-reverse" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.modeToggle}>
          {(['camera', 'manual'] as const).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[styles.modeBtn, scanMode === mode && styles.modeBtnActive]}
              onPress={() => setScanMode(mode)}
            >
              <Text style={[styles.modeBtnText, scanMode === mode && styles.modeBtnTextActive]}>
                {mode === 'camera' ? 'Scan' : 'Search'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.iconBtn} onPress={pickFromGallery}>
          <Ionicons name="images" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Camera viewfinder */}
      {scanMode === 'camera' && (
        <View style={styles.viewfinder}>
          <View style={styles.frameBox}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.guideText}>Point at a bottle or barcode</Text>
        </View>
      )}

      {/* Manual search */}
      {scanMode === 'manual' && (
        <View style={styles.searchContainer}>
          <Text style={styles.searchTitle}>Search 1,000+ beverages</Text>
          <GlassCard style={styles.searchCard}>
            <Ionicons name="search" size={20} color={THEME.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="e.g. Red Bull, Coca-Cola, Water..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleManualSearch}
              returnKeyType="search"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={THEME.textMuted} />
              </TouchableOpacity>
            )}
          </GlassCard>
          <TouchableOpacity
            style={[styles.searchSubmit, searchQuery.length < 2 && { opacity: 0.4 }]}
            onPress={handleManualSearch}
            disabled={searchQuery.length < 2}
          >
            <LinearGradient colors={[THEME.primary, THEME.secondary]} style={styles.searchSubmitGradient}>
              <Text style={styles.searchSubmitText}>Analyse Drink</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom capture bar */}
      {scanMode === 'camera' && (
        <View style={[styles.captureBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={{ width: 50 }} />
          <TouchableOpacity style={styles.captureBtn} onPress={handleCapture} activeOpacity={0.8}>
            <LinearGradient colors={[THEME.primary, THEME.secondary]} style={styles.captureBtnInner}>
              <Ionicons name="camera" size={30} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <View style={{ width: 50 }} />
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },

  // Permission
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 36, backgroundColor: THEME.background },
  permIcon: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  permTitle: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 12 },
  permSub: { fontSize: 15, color: THEME.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  permBtn: { backgroundColor: THEME.primary, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 30 },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Processing
  processingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  scannerBox: {
    width: 180, height: 180, marginBottom: 48,
    borderColor: 'rgba(6,182,212,0.3)', borderWidth: 1, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  scanCorner: { position: 'absolute', width: 28, height: 28, borderColor: THEME.primary, borderWidth: 3 },
  tl: { top: -1, left: -1, borderTopLeftRadius: 16, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: -1, right: -1, borderTopRightRadius: 16, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: -1, left: -1, borderBottomLeftRadius: 16, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: -1, right: -1, borderBottomRightRadius: 16, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: {
    width: '100%', height: 2,
    backgroundColor: THEME.primary,
    shadowColor: THEME.primary, shadowOpacity: 1, shadowRadius: 8, elevation: 8,
  },
  stageContainer: { alignItems: 'center', marginBottom: 32 },
  stageMessage: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  stageSub: { fontSize: 14, color: THEME.textMuted },
  progressTrack: { width: '100%', height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', backgroundColor: THEME.primary, borderRadius: 3 },
  progressPct: { fontSize: 13, color: THEME.textMuted, fontWeight: '600' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, zIndex: 100 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modeToggle: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 22, padding: 3 },
  modeBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 19 },
  modeBtnActive: { backgroundColor: 'rgba(6,182,212,0.3)' },
  modeBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  modeBtnTextActive: { color: '#fff' },

  // Viewfinder
  viewfinder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  frameBox: { width: 260, height: 260, position: 'relative' },
  corner: { position: 'absolute', width: 36, height: 36, borderColor: THEME.primary, borderWidth: 4 },
  guideText: { color: '#fff', fontSize: 15, fontWeight: '500', marginTop: 32, backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },

  // Manual search
  searchContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  searchTitle: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 24 },
  searchCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 28, gap: 10, marginBottom: 16 },
  searchInput: { flex: 1, color: '#fff', fontSize: 17, padding: 0 },
  searchSubmit: { borderRadius: 28 },
  searchSubmitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 28 },
  searchSubmitText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Capture bar
  captureBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40, paddingTop: 20 },
  captureBtn: { width: 76, height: 76, borderRadius: 38, overflow: 'hidden', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  captureBtnInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Results
  resultContainer: { flex: 1, backgroundColor: THEME.background },
  resultScroll: { padding: 20, paddingTop: 12 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  mainCard: { padding: 20, borderRadius: 28, marginBottom: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  mainMeta: { flex: 1 },
  productName: { color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 26 },
  brandName: { color: THEME.textMuted, fontSize: 13, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, marginTop: 10 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  confidenceTag: { fontSize: 11, color: THEME.success, marginTop: 6, fontWeight: '600' },
  viralBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'rgba(6,182,212,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(6,182,212,0.2)' },
  viralText: { flex: 1, color: THEME.primary, fontSize: 13, fontWeight: '600', fontStyle: 'italic' },
  insightBox: { flexDirection: 'row', gap: 10, marginTop: 14, padding: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18 },
  insightText: { flex: 1, color: THEME.textMuted, fontSize: 13, lineHeight: 20 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statBox: { width: (SCREEN_WIDTH - 60) / 2, padding: 16, borderRadius: 20, alignItems: 'center', gap: 6 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '800' },
  statLabel: { color: THEME.textMuted, fontSize: 12, fontWeight: '600' },

  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 12 },
  impactCard: { padding: 16, borderRadius: 24, marginBottom: 20 },
  impactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  impactIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(6,182,212,0.12)', justifyContent: 'center', alignItems: 'center' },
  impactLabel: { color: THEME.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  impactText: { color: THEME.text, fontSize: 13, lineHeight: 19 },

  altRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  altCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  altText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 32 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
