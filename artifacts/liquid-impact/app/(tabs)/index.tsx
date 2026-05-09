import React from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import {
  ScoreRing,
  GlassCard,
  DrinkCard,
  StatCard,
  MissionRow,
  SectionHeader,
  EmptyState,
} from "@/components/ui";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, avgScore, weeklyScores } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);

  const recentScans = state.scans.slice(0, 3);
  const todayScans = state.scans.filter(
    (s) => new Date(s.scannedAt).toDateString() === new Date().toDateString()
  );

  const handleScan = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(tabs)/scan");
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, fontWeight: "500" }}>
              {getGreeting()}
            </Text>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 26,
                fontWeight: "800",
                fontFamily: "Inter_700Bold",
                marginTop: 2,
              }}
            >
              Liquid Impact
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: `${colors.warning}18`,
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: `${colors.warning}30`,
            }}
          >
            <Ionicons name="flame" size={16} color={colors.warning} />
            <Text style={{ color: colors.warning, fontSize: 14, fontWeight: "700" }}>
              {state.streak}
            </Text>
          </View>
        </View>

        {/* Weekly Score Card */}
        <GlassCard>
          <View style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text
              style={{
                color: colors.subtext,
                fontSize: 12,
                fontWeight: "600",
                letterSpacing: 1,
                marginBottom: 16,
                textTransform: "uppercase",
              }}
            >
              Weekly Average Score
            </Text>
            <ScoreRing score={avgScore} size={160} strokeWidth={14} />
            <View style={{ flexDirection: "row", gap: 16, marginTop: 20 }}>
              {weeklyScores.slice(0, 7).map((d, i) => (
                <View key={i} style={{ alignItems: "center", gap: 4 }}>
                  <View
                    style={{
                      width: 6,
                      height: Math.max(4, (d.score / 100) * 32),
                      borderRadius: 3,
                      backgroundColor:
                        d.score >= 80
                          ? colors.scoreHigh
                          : d.score >= 50
                          ? colors.scoreMedium
                          : d.score > 0
                          ? colors.scoreLow
                          : colors.border,
                    }}
                  />
                  <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>
                    {d.shortDay}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </GlassCard>

        {/* Stats Row */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <StatCard
            icon="scan-outline"
            iconColor={colors.primary}
            title="Total Scans"
            value={String(state.scans.length)}
          />
          <StatCard
            icon="star"
            iconColor={colors.warning}
            title="Avg Score"
            value={avgScore > 0 ? String(avgScore) : "—"}
            valueColor={
              avgScore >= 80
                ? colors.scoreHigh
                : avgScore >= 50
                ? colors.scoreMedium
                : avgScore > 0
                ? colors.scoreLow
                : colors.foreground
            }
          />
          <StatCard
            icon="flame"
            iconColor={colors.warning}
            title="Streak"
            value={`${state.streak}d`}
            valueColor={colors.warning}
          />
        </View>

        {/* Scan CTA */}
        <TouchableOpacity
          onPress={handleScan}
          activeOpacity={0.85}
          style={{ borderRadius: 28, overflow: "hidden" }}
        >
          <LinearGradient
            colors={["#FF6B9D", "#7B2CBF", "#00B4D8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              paddingVertical: 20,
            }}
          >
            <Ionicons name="camera" size={24} color="#fff" />
            <Text
              style={{
                color: "#fff",
                fontSize: 18,
                fontWeight: "800",
                fontFamily: "Inter_700Bold",
              }}
            >
              Scan Your Drink
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Recent Scans */}
        <View style={{ gap: 12 }}>
          <SectionHeader
            title="Recent Scans"
            action={
              state.scans.length > 3
                ? { label: "See All", onPress: () => router.push("/(tabs)/history") }
                : undefined
            }
          />
          {recentScans.length > 0 ? (
            recentScans.map((scan) => (
              <DrinkCard
                key={scan.id}
                scan={scan}
                onPress={() => router.push(`/report?id=${scan.id}`)}
              />
            ))
          ) : (
            <GlassCard>
              <EmptyState
                icon="camera-outline"
                title="No scans yet"
                subtitle="Scan your first drink to see your health impact score"
                action={{ label: "Scan Now", onPress: handleScan }}
              />
            </GlassCard>
          )}
        </View>

        {/* AI Insight */}
        {state.scans.length > 0 && (
          <GlassCard>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: colors.primaryDim,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="sparkles" size={20} color={colors.primary} />
                </View>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 17,
                    fontWeight: "700",
                    fontFamily: "Inter_700Bold",
                  }}
                >
                  AI Insight
                </Text>
              </View>
              <Text
                style={{
                  color: colors.subtext,
                  fontSize: 14,
                  lineHeight: 22,
                }}
              >
                {state.scans[0].aiInsight}
              </Text>
              {state.scans[0].viralStatement && (
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 13,
                    fontWeight: "600",
                    fontStyle: "italic",
                  }}
                >
                  "{state.scans[0].viralStatement}"
                </Text>
              )}
            </View>
          </GlassCard>
        )}

        {/* Daily Missions */}
        <View style={{ gap: 12 }}>
          <SectionHeader title="Daily Missions" />
          {state.missions.map((m) => (
            <MissionRow key={m.id} mission={m} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
