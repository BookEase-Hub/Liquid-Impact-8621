import React, { useEffect } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Polyline,
  Path,
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { ScanResult, ScanStatus, DailyMission, WeeklyScore } from "@/types";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Score Ring ─────────────────────────────────────────────────────────────────

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  animated?: boolean;
  label?: string;
}

export function ScoreRing({ score, size = 120, strokeWidth = 12, animated = true, label }: ScoreRingProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = animated
      ? withTiming(score / 100, { duration: 1400, easing: Easing.out(Easing.cubic) })
      : score / 100;
  }, [score, animated]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const gradId = `grad-${size}-${score}`;

  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill as ViewStyle}>
        <Defs>
          <SvgLinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#00B4D8" />
            <Stop offset="100%" stopColor="#7B2CBF" />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={cx} cy={cy} r={radius}
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
      </Svg>
      <Text style={{ color: scoreColor(score), fontSize: size * 0.28, fontWeight: "800", fontFamily: "Inter_700Bold" }}>
        {score}
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: size * 0.1, marginTop: 1 }}>
        {label ?? "/ 100"}
      </Text>
    </View>
  );
}

// ─── Body Status Ring (non-animated for speed) ─────────────────────────────────

interface BodyRingProps {
  value: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  size?: number;
}

export function BodyRing({ value, label, icon, color, size = 80 }: BodyRingProps) {
  const colors = useColors();
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(value, 100) / 100);

  return (
    <View style={{ alignItems: "center", gap: 6, flex: 1 }}>
      <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={8} fill="none" />
          <Circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={8} fill="none"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            transform={`rotate(-90, ${size/2}, ${size/2})`}
          />
        </Svg>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800", fontFamily: "Inter_700Bold" }}>
        {value > 0 ? `${value}%` : "—"}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 10, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

// ─── Line Chart (SVG) ──────────────────────────────────────────────────────────

interface LineChartProps {
  data: WeeklyScore[];
  width?: number;
  height?: number;
}

export function LineChart({ data, width = 300, height = 100 }: LineChartProps) {
  const colors = useColors();
  const nonZeroData = data.filter((d) => d.score > 0);
  if (nonZeroData.length < 2) {
    return (
      <View style={{ width, height, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Not enough data yet</Text>
      </View>
    );
  }

  const max = Math.max(...data.map((d) => d.score), 1);
  const stepX = width / (data.length - 1);
  const pad = 10;

  const points = data.map((d, i) => ({
    x: i * stepX,
    y: d.score > 0 ? height - pad - ((d.score / max) * (height - pad * 2)) : null,
  }));

  const linePoints = points
    .filter((p) => p.y !== null)
    .map((p) => `${p.x.toFixed(1)},${p.y!.toFixed(1)}`)
    .join(" ");

  const firstValid = points.find((p) => p.y !== null);
  const lastValid = [...points].reverse().find((p) => p.y !== null);

  const fillPath =
    firstValid && lastValid
      ? `M${firstValid.x},${firstValid.y} ` +
        points
          .filter((p) => p.y !== null)
          .map((p) => `L${p.x.toFixed(1)},${p.y!.toFixed(1)}`)
          .join(" ") +
        ` L${lastValid.x},${height} L${firstValid.x},${height} Z`
      : "";

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#00B4D8" stopOpacity="0.4" />
          <Stop offset="100%" stopColor="#00B4D8" stopOpacity="0.02" />
        </SvgLinearGradient>
      </Defs>
      {fillPath ? <Path d={fillPath} fill="url(#lineGrad)" /> : null}
      {linePoints ? (
        <Polyline
          points={linePoints}
          fill="none"
          stroke="#00B4D8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {points.map((p, i) =>
        p.y !== null ? (
          <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#00B4D8" />
        ) : null,
      )}
    </Svg>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

export function scoreColor(score: number): string {
  if (score >= 80) return "#00C853";
  if (score >= 50) return "#FF9800";
  return "#FF3D00";
}

export function statusColor(status: ScanStatus): string {
  switch (status) {
    case "optimal": return "#00C853";
    case "stable": return "#00B4D8";
    case "risky": return "#FF9800";
    case "damaging": return "#FF3D00";
  }
}

export function statusLabel(status: ScanStatus): string {
  switch (status) {
    case "optimal": return "Optimal";
    case "stable": return "Stable";
    case "risky": return "Use Less Often";
    case "damaging": return "High Impact";
  }
}

export function categoryIcon(category: string): keyof typeof Ionicons.glyphMap {
  switch (category.toLowerCase()) {
    case "water": return "water";
    case "coffee": return "cafe";
    case "tea": return "leaf";
    case "juice": return "nutrition";
    case "soda": return "beer";
    case "energy": return "flash";
    case "alcohol": return "wine";
    case "smoothie": return "color-fill";
    case "sport": return "fitness";
    case "milk": return "water-outline";
    case "olive_oil": case "vegetable_oil": case "cooking_oil": return "flask";
    case "vinegar": case "condiment": return "beaker";
    default: return "beaker";
  }
}

// ─── Glass Card ────────────────────────────────────────────────────────────────

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  gradient?: boolean;
}

export function GlassCard({ children, style, padding = 16, gradient = false }: GlassCardProps) {
  const colors = useColors();
  if (gradient) {
    return (
      <View style={[{ borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: `${colors.primary}25` }, style]}>
        <LinearGradient
          colors={["rgba(0,180,216,0.08)", "rgba(123,44,191,0.08)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding }}
        >
          {children}
        </LinearGradient>
      </View>
    );
  }
  return (
    <View style={[{ backgroundColor: colors.backgroundSecondary, borderRadius: 24, padding, borderWidth: 1, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

// ─── Quick Action Button ────────────────────────────────────────────────────────

interface QuickActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  color: string;
  onPress: () => void;
  badge?: string;
}

export function QuickActionButton({ icon, title, color, onPress, badge }: QuickActionButtonProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flex: 1,
        backgroundColor: `${color}14`,
        borderRadius: 18,
        padding: 14,
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
        borderColor: `${color}25`,
        position: "relative",
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: `${color}20`, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700", textAlign: "center" }}>{title}</Text>
      {badge && (
        <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: color, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Impact Story Card ─────────────────────────────────────────────────────────

interface ImpactStoryCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  message: string;
}

export function ImpactStoryCard({ icon, iconColor, title, message }: ImpactStoryCardProps) {
  const colors = useColors();
  return (
    <View style={{
      backgroundColor: `${iconColor}0D`,
      borderRadius: 16,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: `${iconColor}25`,
    }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: `${iconColor}20`, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: iconColor, fontSize: 12, fontWeight: "700", marginBottom: 2 }}>{title}</Text>
        <Text style={{ color: colors.subtext, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>{message}</Text>
      </View>
    </View>
  );
}

// ─── Drink Card ────────────────────────────────────────────────────────────────

interface DrinkCardProps {
  scan: ScanResult;
  onPress?: () => void;
}

export function DrinkCard({ scan, onPress }: DrinkCardProps) {
  const colors = useColors();
  const color = statusColor(scan.status);
  const timeStr = new Date(scan.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View style={{
        width: 52, height: 52, borderRadius: 16,
        backgroundColor: `${color}14`, borderWidth: 1, borderColor: `${color}25`,
        justifyContent: "center", alignItems: "center",
      }}>
        <Ionicons name={categoryIcon(scan.category)} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" }} numberOfLines={1}>
          {scan.detectedProduct}
        </Text>
        {scan.brand && <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 1 }}>{scan.brand}</Text>}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: `${color}14` }}>
            <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{statusLabel(scan.status)}</Text>
          </View>
          {scan.liquidType !== "beverage" && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "#FF980014" }}>
              <Text style={{ color: "#FF9800", fontSize: 10, fontWeight: "600" }}>
                {scan.liquidType === "cooking_oil" ? "Oil" : scan.liquidType === "condiment" ? "Condiment" : scan.liquidType}
              </Text>
            </View>
          )}
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{timeStr}</Text>
        </View>
      </View>
      <View style={{ alignItems: "center" }}>
        <Text style={{ color: scoreColor(scan.impactScore), fontSize: 22, fontWeight: "800", fontFamily: "Inter_700Bold" }}>
          {scan.impactScore}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>score</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  value: string;
  valueColor?: string;
}

export function StatCard({ icon, iconColor, title, value, valueColor }: StatCardProps) {
  const colors = useColors();
  return (
    <View style={{
      flex: 1,
      backgroundColor: `${colors.backgroundSecondary}99`,
      borderRadius: 20, padding: 14,
      borderWidth: 1, borderColor: colors.border,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Ionicons name={icon} size={14} color={iconColor} />
        <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "600" }}>{title}</Text>
      </View>
      <Text style={{ color: valueColor ?? colors.foreground, fontSize: 24, fontWeight: "800", fontFamily: "Inter_700Bold" }}>
        {value}
      </Text>
    </View>
  );
}

// ─── Mission Row ───────────────────────────────────────────────────────────────

export function MissionRow({ mission }: { mission: DailyMission }) {
  const colors = useColors();
  const pct = Math.round((mission.progress / mission.target) * 100);
  return (
    <View style={{
      backgroundColor: `${colors.backgroundSecondary}66`,
      borderRadius: 20, padding: 14,
      borderWidth: 1,
      borderColor: mission.completed ? `${colors.success}30` : colors.border,
      flexDirection: "row", alignItems: "center", gap: 12,
    }}>
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: mission.completed ? colors.successDim : colors.primaryDim,
        justifyContent: "center", alignItems: "center",
      }}>
        <Ionicons name={mission.icon as keyof typeof Ionicons.glyphMap} size={18}
          color={mission.completed ? colors.success : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" }}>{mission.title}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 1 }}>{mission.description}</Text>
        <View style={{ height: 4, backgroundColor: colors.backgroundTertiary, borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
          <View style={{ width: `${pct}%`, height: "100%", backgroundColor: mission.completed ? colors.success : colors.primary, borderRadius: 2 }} />
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: mission.completed ? colors.success : colors.primary, fontSize: 13, fontWeight: "700" }}>
          {mission.progress}/{mission.target}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 2 }}>+{mission.xp} XP</Text>
      </View>
    </View>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ color: colors.foreground, fontSize: 19, fontWeight: "800", fontFamily: "Inter_700Bold" }}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const colors = useColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 }}>
      <View style={{ width: 68, height: 68, borderRadius: 20, backgroundColor: colors.primaryDim, justifyContent: "center", alignItems: "center", marginBottom: 14 }}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 6 }}>{title}</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center", lineHeight: 19 }}>{subtitle}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress} activeOpacity={0.8}
          style={{ marginTop: 18, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: `${colors.primary}40` }}>
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Loading Spinner ───────────────────────────────────────────────────────────

export function LoadingSpinner({ size = "large" }: { size?: "small" | "large" }) {
  return <ActivityIndicator size={size} color="#00B4D8" />;
}

// ─── Gradient Button ───────────────────────────────────────────────────────────

interface GradientButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  colors?: [string, string, ...string[]];
}

export function GradientButton({ onPress, children, disabled, style, colors: btnColors }: GradientButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85}
      style={[{ borderRadius: 24, overflow: "hidden" }, style]}>
      <LinearGradient
        colors={disabled ? ["#3A3A4A", "#3A3A4A"] : (btnColors ?? ["#FF6B9D", "#7B2CBF", "#00B4D8"])}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ paddingVertical: 18, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" }}>
        {children}
      </LinearGradient>
    </TouchableOpacity>
  );
}
