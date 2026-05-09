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
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { ScanResult, ScanStatus } from "@/types";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Score Ring ────────────────────────────────────────────────────────────────

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  animated?: boolean;
}

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 12,
  animated = true,
}: ScoreRingProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const progress = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      progress.value = withTiming(score / 100, {
        duration: 1400,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progress.value = score / 100;
    }
  }, [score, animated]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const scoreColor =
    score >= 80 ? "#00C853" : score >= 50 ? "#FF9800" : "#FF3D00";

  return (
    <View
      style={{
        width: size,
        height: size,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill as ViewStyle}
      >
        <Defs>
          <SvgLinearGradient id={`grad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#00B4D8" />
            <Stop offset="100%" stopColor="#7B2CBF" />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={`url(#grad-${size})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
      </Svg>
      <Text
        style={{
          color: scoreColor,
          fontSize: size * 0.28,
          fontWeight: "800",
          fontFamily: "Inter_700Bold",
        }}
      >
        {score}
      </Text>
      <Text
        style={{ color: "rgba(255,255,255,0.4)", fontSize: size * 0.1, marginTop: 1 }}
      >
        / 100
      </Text>
    </View>
  );
}

// ─── Status Badge ───────────────────────────────────────────────────────────────

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
    case "risky": return "Risky";
    case "damaging": return "Damaging";
  }
}

// ─── Glass Card ────────────────────────────────────────────────────────────────

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export function GlassCard({ children, style, padding = 16 }: GlassCardProps) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.backgroundSecondary,
          borderRadius: 24,
          padding,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── Gradient Button ───────────────────────────────────────────────────────────

interface GradientButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
}

export function GradientButton({
  onPress,
  children,
  disabled,
  style,
}: GradientButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[{ borderRadius: 24, overflow: "hidden" }, style]}
    >
      <LinearGradient
        colors={disabled ? ["#3A3A4A", "#3A3A4A"] : ["#FF6B9D", "#7B2CBF", "#00B4D8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingVertical: 18,
          paddingHorizontal: 24,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </LinearGradient>
    </TouchableOpacity>
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
  const timeStr = new Date(scan.scannedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

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
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: `${color}18`,
          borderWidth: 1,
          borderColor: `${color}30`,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons
          name={categoryIcon(scan.category)}
          size={22}
          color={color}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 15,
            fontWeight: "700",
            fontFamily: "Inter_700Bold",
          }}
          numberOfLines={1}
        >
          {scan.detectedProduct}
        </Text>
        {scan.brand && (
          <Text
            style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 1 }}
          >
            {scan.brand}
          </Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 8,
              backgroundColor: `${color}18`,
            }}
          >
            <Text style={{ color, fontSize: 11, fontWeight: "600" }}>
              {statusLabel(scan.status)}
            </Text>
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            {timeStr}
          </Text>
        </View>
      </View>

      <View style={{ alignItems: "center" }}>
        <Text
          style={{
            color: scan.impactScore >= 80
              ? colors.scoreHigh
              : scan.impactScore >= 50
              ? colors.scoreMedium
              : colors.scoreLow,
            fontSize: 22,
            fontWeight: "800",
            fontFamily: "Inter_700Bold",
          }}
        >
          {scan.impactScore}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>score</Text>
      </View>
    </TouchableOpacity>
  );
}

function categoryIcon(category: string): keyof typeof Ionicons.glyphMap {
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
    default: return "beaker";
  }
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
    <View
      style={{
        flex: 1,
        backgroundColor: `${colors.backgroundSecondary}99`,
        borderRadius: 20,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Ionicons name={icon} size={16} color={iconColor} />
        <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "600" }}>
          {title}
        </Text>
      </View>
      <Text
        style={{
          color: valueColor ?? colors.foreground,
          fontSize: 26,
          fontWeight: "800",
          fontFamily: "Inter_700Bold",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Mission Row ───────────────────────────────────────────────────────────────

import type { DailyMission } from "@/types";

interface MissionRowProps {
  mission: DailyMission;
}

export function MissionRow({ mission }: MissionRowProps) {
  const colors = useColors();
  const progress = mission.progress / mission.target;
  const pct = Math.round(progress * 100);

  return (
    <View
      style={{
        backgroundColor: `${colors.backgroundSecondary}66`,
        borderRadius: 20,
        padding: 14,
        borderWidth: 1,
        borderColor: mission.completed ? `${colors.success}30` : colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: mission.completed ? colors.successDim : colors.primaryDim,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons
          name={mission.icon as keyof typeof Ionicons.glyphMap}
          size={18}
          color={mission.completed ? colors.success : colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 14,
            fontWeight: "700",
            fontFamily: "Inter_700Bold",
          }}
        >
          {mission.title}
        </Text>
        <Text
          style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 1 }}
        >
          {mission.description}
        </Text>
        <View
          style={{
            height: 4,
            backgroundColor: colors.backgroundTertiary,
            borderRadius: 2,
            marginTop: 8,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${pct}%`,
              height: "100%",
              backgroundColor: mission.completed ? colors.success : colors.primary,
              borderRadius: 2,
            }}
          />
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={{
            color: mission.completed ? colors.success : colors.primary,
            fontSize: 13,
            fontWeight: "700",
          }}
        >
          {mission.progress}/{mission.target}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 2 }}>
          +{mission.xp} XP
        </Text>
      </View>
    </View>
  );
}

// ─── Loading Spinner ───────────────────────────────────────────────────────────

export function LoadingSpinner({ size = "large" }: { size?: "small" | "large" }) {
  return <ActivityIndicator size={size} color="#00B4D8" />;
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
    <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          backgroundColor: colors.primaryDim,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <Text
        style={{
          color: colors.foreground,
          fontSize: 18,
          fontWeight: "700",
          fontFamily: "Inter_700Bold",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 14,
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {subtitle}
      </Text>
      {action && (
        <TouchableOpacity
          onPress={action.onPress}
          activeOpacity={0.8}
          style={{
            marginTop: 20,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: colors.primaryDim,
            borderWidth: 1,
            borderColor: `${colors.primary}40`,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>
            {action.label}
          </Text>
        </TouchableOpacity>
      )}
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
      <Text
        style={{
          color: colors.foreground,
          fontSize: 20,
          fontWeight: "800",
          fontFamily: "Inter_700Bold",
        }}
      >
        {title}
      </Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
            {action.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
