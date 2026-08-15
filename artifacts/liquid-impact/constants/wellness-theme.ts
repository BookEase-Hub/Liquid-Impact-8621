import { Easing } from 'react-native';
import type { GlycemicImpact, ScanStatus, TimeHorizon } from '../types';

export interface FluctuationConfig {
  shortTerm: { min: number; max: number; volatility: number };
  mediumTerm: { min: number; max: number; volatility: number };
  longTerm: { min: number; max: number; volatility: number };
}

export interface TimeBasedImpact {
  current: number;
  shortTerm: { value: number; trend: 'up' | 'down' | 'stable'; confidence: number };
  mediumTerm: { value: number; trend: 'up' | 'down' | 'stable'; confidence: number };
  longTerm: { value: number; trend: 'up' | 'down' | 'stable'; confidence: number };
  lastUpdated: number;
  fluctuationHistory: { timestamp: number; value: number; horizon: TimeHorizon }[];
}

export const THEME = {
  colors: {
    background: '#0a0a0f', surface: '#12121a', surfaceElevated: '#1a1a24', surfaceGlass: 'rgba(26, 26, 36, 0.7)',
    primary: '#6366f1', primaryLight: '#818cf8', secondary: '#22d3ee', secondaryLight: '#67e8f9',
    success: '#10b981', successLight: '#34d399', warning: '#f59e0b', warningLight: '#fbbf24',
    error: '#ef4444', errorLight: '#f87171', info: '#3b82f6', infoLight: '#60a5fa',
    purple: '#a78bfa', purpleLight: '#c4b5fd', orange: '#fb923c', orangeLight: '#fdba74',
    red: '#f87171', redLight: '#fca5a5', yellow: '#fcd34d', yellowLight: '#fde68a',
    green: '#34d399', greenLight: '#6ee7b7', cyan: '#22d3ee', cyanLight: '#67e8f9',
    text: '#f8fafc', textSecondary: '#94a3b8', textMuted: '#64748b', textDisabled: '#475569',
    border: '#27273a', borderLight: '#3f3f56', shadow: 'rgba(0, 0, 0, 0.4)', overlay: 'rgba(10, 10, 15, 0.8)',
    glassBorder: 'rgba(255, 255, 255, 0.1)', glassHighlight: 'rgba(255, 255, 255, 0.05)',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, xxxx: 40, huge: 48 },
  borderRadius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 9999 },
  typography: {
    h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
    h2: { fontSize: 24, fontWeight: '600' as const, letterSpacing: -0.3 },
    h3: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.2 },
    h4: { fontSize: 18, fontWeight: '500' as const, letterSpacing: -0.1 },
    body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodySm: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    bodyXs: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
    caption: { fontSize: 11, fontWeight: '400' as const, lineHeight: 14 },
    label: { fontSize: 13, fontWeight: '500' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  },
  shadows: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 },
  },
  animations: {
    duration: { fast: 150, normal: 300, slow: 500, slower: 800 },
    easing: { standard: Easing.bezier(0.4, 0, 0.2, 1), bounce: Easing.bezier(0.175, 0.885, 0.32, 1.275) },
  },
} as const;

export const NUTRITION_COLORS = {
  calories: THEME.colors.orange, sugar: THEME.colors.red, fat: THEME.colors.green,
  protein: THEME.colors.green, sodium: THEME.colors.yellow, caffeine: THEME.colors.purple,
  fiber: THEME.colors.cyan, vitamins: THEME.colors.secondary,
} as const;

export const GLYCEMIC_COLORS: Record<GlycemicImpact, string> = {
  low: THEME.colors.success, moderate: THEME.colors.warning, high: THEME.colors.error, very_high: THEME.colors.errorLight,
};

export const RISK_COLORS: Record<'low' | 'medium' | 'high', string> = {
  low: THEME.colors.success, medium: THEME.colors.warning, high: THEME.colors.error,
};

export const STATUS_COLORS: Record<ScanStatus, string> = {
  optimal: THEME.colors.success, stable: THEME.colors.warning, risky: THEME.colors.orange,
  damaging: THEME.colors.error, unknown: THEME.colors.textMuted,
};

export const FLUCTUATION_CONFIGS: Record<string, FluctuationConfig> = {
  soda: { shortTerm: { min: -15, max: 15, volatility: 0.3 }, mediumTerm: { min: -25, max: 25, volatility: 0.5 }, longTerm: { min: -40, max: 40, volatility: 0.7 } },
  energy: { shortTerm: { min: -20, max: 20, volatility: 0.4 }, mediumTerm: { min: -35, max: 35, volatility: 0.6 }, longTerm: { min: -50, max: 50, volatility: 0.8 } },
  water: { shortTerm: { min: -2, max: 2, volatility: 0.05 }, mediumTerm: { min: -5, max: 5, volatility: 0.1 }, longTerm: { min: -10, max: 10, volatility: 0.2 } },
  juice: { shortTerm: { min: -10, max: 10, volatility: 0.25 }, mediumTerm: { min: -20, max: 20, volatility: 0.45 }, longTerm: { min: -35, max: 35, volatility: 0.65 } },
  sports: { shortTerm: { min: -8, max: 8, volatility: 0.2 }, mediumTerm: { min: -15, max: 15, volatility: 0.35 }, longTerm: { min: -25, max: 25, volatility: 0.55 } },
  beer: { shortTerm: { min: -12, max: 12, volatility: 0.28 }, mediumTerm: { min: -22, max: 22, volatility: 0.48 }, longTerm: { min: -38, max: 38, volatility: 0.68 } },
  spirits: { shortTerm: { min: -18, max: 18, volatility: 0.35 }, mediumTerm: { min: -30, max: 30, volatility: 0.55 }, longTerm: { min: -45, max: 45, volatility: 0.75 } },
  tea: { shortTerm: { min: -5, max: 5, volatility: 0.15 }, mediumTerm: { min: -10, max: 10, volatility: 0.25 }, longTerm: { min: -18, max: 18, volatility: 0.4 } },
  coffee: { shortTerm: { min: -8, max: 8, volatility: 0.22 }, mediumTerm: { min: -15, max: 15, volatility: 0.38 }, longTerm: { min: -28, max: 28, volatility: 0.58 } },
  default: { shortTerm: { min: -10, max: 10, volatility: 0.25 }, mediumTerm: { min: -20, max: 20, volatility: 0.45 }, longTerm: { min: -35, max: 35, volatility: 0.65 } },
};

export const calculateTimeBasedImpact = (
  baseImpact: number,
  category: string,
  hoursSinceConsumption: number = 0
): TimeBasedImpact => {
  const config = FLUCTUATION_CONFIGS[category] || FLUCTUATION_CONFIGS.default;
  const now = Date.now();
  const calculateFluctuation = (horizon: 'shortTerm' | 'mediumTerm' | 'longTerm') => {
    const cfg = config[horizon];
    const timeFactor = Math.min(1, hoursSinceConsumption / (horizon === 'shortTerm' ? 2 : horizon === 'mediumTerm' ? 24 : 168));
    const randomFactor = (Math.sin(now * 0.001 + horizon.length) + 1) / 2;
    const volatility = cfg.volatility * (1 - timeFactor * 0.5);
    const fluctuation = (cfg.min + (cfg.max - cfg.min) * randomFactor) * volatility;
    const value = Math.max(0, Math.min(100, baseImpact + fluctuation));
    return {
      value: Math.round(value * 10) / 10,
      trend: fluctuation > 3 ? 'up' : fluctuation < -3 ? 'down' : 'stable' as 'up' | 'down' | 'stable',
      confidence: Math.round((0.7 + (1 - timeFactor) * 0.25) * 100) / 100,
    };
  };

  return {
    current: baseImpact,
    shortTerm: calculateFluctuation('shortTerm'),
    mediumTerm: calculateFluctuation('mediumTerm'),
    longTerm: calculateFluctuation('longTerm'),
    lastUpdated: now,
    fluctuationHistory: [],
  };
};
