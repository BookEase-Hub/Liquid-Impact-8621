import React from "react";
import { ScrollView, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard, DrinkCard, SectionHeader, EmptyState } from "@/components/ui";
import { useRouter } from "expo-router";

interface BodyRingProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  color: string;
  size?: number;
}

function BodyRing({ label, icon, value, color, size = 80 }: BodyRingProps) {
  const colors = useColors();
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);

  return (
    <View style={{ alignItems: "center", gap: 8, flex: 1 }}>
      <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={8}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={8}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform={`rotate(-90, ${size / 2}, ${size / 2})`}
          />
        </Svg>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800" }}>
        {value}%
      </Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "center" }}>
        {label}
      </Text>
    </View>
  );
}

export default function StatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useApp();

  const recent = state.scans.slice(0, 10);

  const avgHydration =
    recent.length > 0
      ? Math.round(recent.reduce((s, r) => s + r.hydrationLevel, 0) / recent.length)
      : 0;

  const avgScore =
    recent.length > 0
      ? Math.round(recent.reduce((s, r) => s + r.impactScore, 0) / recent.length)
      : 0;

  const avgCaffeine =
    recent.length > 0
      ? recent.reduce((s, r) => s + r.composition.caffeineMg, 0) / recent.length
      : 0;

  const energyScore = Math.min(100, Math.max(0, avgScore));
  const recoveryScore = Math.min(100, Math.max(0, 100 - (avgCaffeine / 200) * 100));
  const focusScore = Math.min(100, Math.max(0, 50 + avgScore * 0.5));

  const todayScans = state.scans.filter(
    (s) => new Date(s.scannedAt).toDateString() === new Date().toDateString()
  );

  const todayAvg =
    todayScans.length > 0
      ? Math.round(todayScans.reduce((s, r) => s + r.impactScore, 0) / todayScans.length)
      : null;

  const overallStatus =
    avgScore >= 80
      ? { label: "Optimal", color: colors.scoreHigh }
      : avgScore >= 60
      ? { label: "Good", color: colors.primary }
      : avgScore >= 40
      ? { label: "Moderate", color: colors.scoreMedium }
      : avgScore > 0
      ? { label: "Needs Work", color: colors.scoreLow }
      : { label: "No Data", color: colors.mutedForeground };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 20,
          gap: 24,
        }}
      >
        {/* Header */}
        <View>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Your</Text>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 26,
              fontWeight: "800",
              fontFamily: "Inter_700Bold",
              marginTop: 2,
            }}
          >
            Body Status
          </Text>
        </View>

        {/* Overall status banner */}
        <GlassCard style={{ borderColor: `${overallStatus.color}30` }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                backgroundColor: `${overallStatus.color}18`,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="body" size={26} color={overallStatus.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                Overall Status
              </Text>
              <Text
                style={{
                  color: overallStatus.color,
                  fontSize: 22,
                  fontWeight: "800",
                  fontFamily: "Inter_700Bold",
                }}
              >
                {overallStatus.label}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                Based on {recent.length} recent scan{recent.length !== 1 ? "s" : ""}
              </Text>
            </View>
            {todayAvg !== null && (
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    color:
                      todayAvg >= 80
                        ? colors.scoreHigh
                        : todayAvg >= 50
                        ? colors.scoreMedium
                        : colors.scoreLow,
                    fontSize: 28,
                    fontWeight: "800",
                    fontFamily: "Inter_700Bold",
                  }}
                >
                  {todayAvg}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                  Today's avg
                </Text>
              </View>
            )}
          </View>
        </GlassCard>

        {/* Body Rings */}
        <GlassCard>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 17,
              fontWeight: "700",
              fontFamily: "Inter_700Bold",
              marginBottom: 20,
            }}
          >
            Body Metrics
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <BodyRing
              label="Hydration"
              icon="water"
              value={avgHydration}
              color={colors.primary}
            />
            <BodyRing
              label="Energy"
              icon="flash"
              value={energyScore}
              color={colors.scoreMedium}
            />
            <BodyRing
              label="Recovery"
              icon="heart"
              value={recoveryScore}
              color={colors.scoreHigh}
            />
            <BodyRing
              label="Focus"
              icon="bulb"
              value={focusScore}
              color={colors.secondary}
            />
          </View>
        </GlassCard>

        {/* Impact breakdown */}
        <GlassCard>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 17,
              fontWeight: "700",
              fontFamily: "Inter_700Bold",
              marginBottom: 16,
            }}
          >
            Drink Breakdown
          </Text>
          {[
            { label: "Optimal (80+)", count: recent.filter((s) => s.impactScore >= 80).length, color: colors.scoreHigh },
            { label: "Stable (50–79)", count: recent.filter((s) => s.impactScore >= 50 && s.impactScore < 80).length, color: colors.primary },
            { label: "Risky (25–49)", count: recent.filter((s) => s.impactScore >= 25 && s.impactScore < 50).length, color: colors.scoreMedium },
            { label: "Damaging (0–24)", count: recent.filter((s) => s.impactScore < 25).length, color: colors.scoreLow },
          ].map((row) => (
            <View
              key={row.label}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: row.color,
                }}
              />
              <Text style={{ flex: 1, color: colors.subtext, fontSize: 13 }}>
                {row.label}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 6,
                  backgroundColor: colors.backgroundTertiary,
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${recent.length > 0 ? (row.count / recent.length) * 100 : 0}%`,
                    height: "100%",
                    backgroundColor: row.color,
                    borderRadius: 3,
                  }}
                />
              </View>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700", width: 24, textAlign: "right" }}>
                {row.count}
              </Text>
            </View>
          ))}
        </GlassCard>

        {/* Recent impact */}
        <View style={{ gap: 12 }}>
          <SectionHeader title="Impact Feed" />
          {state.scans.slice(0, 5).length > 0 ? (
            state.scans.slice(0, 5).map((scan) => (
              <DrinkCard
                key={scan.id}
                scan={scan}
                onPress={() => router.push(`/report?id=${scan.id}`)}
              />
            ))
          ) : (
            <GlassCard>
              <EmptyState
                icon="pulse-outline"
                title="No data yet"
                subtitle="Scan drinks to see your body's impact feed"
              />
            </GlassCard>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
