import React, { useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard, DrinkCard, EmptyState, SectionHeader } from "@/components/ui";
import type { ScanStatus } from "@/types";

const FILTERS: { label: string; value: ScanStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Optimal", value: "optimal" },
  { label: "Stable", value: "stable" },
  { label: "Risky", value: "risky" },
  { label: "Damaging", value: "damaging" },
];

const PERIODS = ["Week", "Month", "Year"];

function filterColor(value: ScanStatus | "all", colors: ReturnType<typeof useColors>) {
  switch (value) {
    case "optimal": return colors.scoreHigh;
    case "stable": return colors.primary;
    case "risky": return colors.scoreMedium;
    case "damaging": return colors.scoreLow;
    default: return colors.primary;
  }
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, weeklyScores } = useApp();
  const [activeFilter, setActiveFilter] = useState<ScanStatus | "all">("all");
  const [activePeriod, setActivePeriod] = useState("Week");

  const filtered =
    activeFilter === "all"
      ? state.scans
      : state.scans.filter((s) => s.status === activeFilter);

  const avgScore =
    state.scans.length > 0
      ? Math.round(state.scans.reduce((s, r) => s + r.impactScore, 0) / state.scans.length)
      : 0;

  const bestScore =
    state.scans.length > 0
      ? Math.max(...state.scans.map((s) => s.impactScore))
      : 0;

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
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Track Your</Text>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 26,
              fontWeight: "800",
              fontFamily: "Inter_700Bold",
              marginTop: 2,
            }}
          >
            Progress
          </Text>
        </View>

        {/* Period selector */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 14,
            padding: 4,
          }}
        >
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setActivePeriod(p)}
              activeOpacity={0.8}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: "center",
                borderRadius: 10,
                backgroundColor:
                  activePeriod === p ? colors.primaryDim : "transparent",
                borderWidth: activePeriod === p ? 1 : 0,
                borderColor: activePeriod === p ? `${colors.primary}40` : "transparent",
              }}
            >
              <Text
                style={{
                  color: activePeriod === p ? colors.primary : colors.mutedForeground,
                  fontSize: 14,
                  fontWeight: "700",
                  fontFamily: "Inter_700Bold",
                }}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Weekly chart */}
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
            Score Trend
          </Text>
          <View style={{ alignItems: "center" }}>
            <Svg width={280} height={140}>
              {weeklyScores.map((d, i) => {
                const barH = Math.max(4, (d.score / 100) * 100);
                const x = i * 40 + 5;
                const y = 100 - barH;
                const barColor =
                  d.score >= 80
                    ? colors.scoreHigh
                    : d.score >= 50
                    ? colors.primary
                    : d.score > 0
                    ? colors.scoreMedium
                    : colors.backgroundTertiary;
                return (
                  <React.Fragment key={i}>
                    <Rect
                      x={x}
                      y={y}
                      width={28}
                      height={barH}
                      rx={6}
                      fill={barColor}
                      opacity={d.count > 0 ? 1 : 0.3}
                    />
                    <SvgText
                      x={x + 14}
                      y={120}
                      textAnchor="middle"
                      fontSize="10"
                      fill={colors.mutedForeground}
                    >
                      {d.shortDay}
                    </SvgText>
                    {d.count > 0 && (
                      <SvgText
                        x={x + 14}
                        y={y - 4}
                        textAnchor="middle"
                        fontSize="9"
                        fill={barColor}
                      >
                        {d.score}
                      </SvgText>
                    )}
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>
        </GlassCard>

        {/* Summary stats */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { label: "Total Scans", value: String(state.scans.length), color: colors.foreground },
            { label: "Avg Score", value: avgScore > 0 ? String(avgScore) : "—", color: avgScore >= 80 ? colors.scoreHigh : avgScore >= 50 ? colors.scoreMedium : colors.foreground },
            { label: "Best Score", value: bestScore > 0 ? String(bestScore) : "—", color: colors.scoreHigh },
            { label: "Streak", value: `${state.streak}d`, color: colors.scoreMedium },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                backgroundColor: colors.backgroundSecondary,
                borderRadius: 16,
                padding: 10,
                alignItems: "center",
                gap: 4,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: s.color,
                  fontSize: 18,
                  fontWeight: "800",
                  fontFamily: "Inter_700Bold",
                }}
              >
                {s.value}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 9, textAlign: "center" }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.value;
            const fc = filterColor(f.value, colors);
            return (
              <TouchableOpacity
                key={f.value}
                onPress={() => setActiveFilter(f.value)}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: isActive ? `${fc}18` : colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: isActive ? `${fc}40` : colors.border,
                }}
              >
                <Text
                  style={{
                    color: isActive ? fc : colors.mutedForeground,
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  {f.label}
                  {f.value !== "all" &&
                    ` (${state.scans.filter((s) => s.status === f.value).length})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Scans list */}
        <View style={{ gap: 12 }}>
          <SectionHeader title={`${filtered.length} Scan${filtered.length !== 1 ? "s" : ""}`} />
          {filtered.length > 0 ? (
            filtered.map((scan) => (
              <DrinkCard
                key={scan.id}
                scan={scan}
                onPress={() => router.push(`/report?id=${scan.id}`)}
              />
            ))
          ) : (
            <GlassCard>
              <EmptyState
                icon="time-outline"
                title="No scans found"
                subtitle={
                  activeFilter === "all"
                    ? "Your scan history will appear here"
                    : `No ${activeFilter} drinks scanned yet`
                }
              />
            </GlassCard>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
