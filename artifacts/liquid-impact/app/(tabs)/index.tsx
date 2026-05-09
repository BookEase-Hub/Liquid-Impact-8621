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
import { useApp, SUBSCRIPTION_LIMITS } from "@/context/AppContext";
import {
  ScoreRing,
  GlassCard,
  DrinkCard,
  StatCard,
  MissionRow,
  SectionHeader,
  EmptyState,
  QuickActionButton,
  ImpactStoryCard,
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
  const { state, avgScore, weeklyScores, canScan, dailyStatus, xpTotal, todayScanCount } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);

  const recentScans = state.scans.slice(0, 3);
  const limits = SUBSCRIPTION_LIMITS[state.subscription];

  const handleScan = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!canScan) {
      router.push("/paywall");
      return;
    }
    router.push("/(tabs)/scan");
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Dynamic impact stories based on scan history
  const impactStories = (() => {
    const stories = [];
    if (state.scans.length === 0) {
      stories.push({ icon: "camera" as const, iconColor: colors.primary, title: "Start Scanning", message: "Scan your first drink to unlock AI-powered health insights." });
    }
    if (dailyStatus.dehydrationRisk) {
      stories.push({ icon: "warning" as const, iconColor: colors.danger, title: "Dehydration Alert", message: "Your recent drinks may cause dehydration. Drink more water!" });
    }
    if (state.streak >= 3) {
      stories.push({ icon: "flame" as const, iconColor: colors.scoreMedium, title: `${state.streak}-Day Streak! 🔥`, message: "You're on a roll! Keep scanning to track your progress." });
    }
    const highSugar = state.scans.slice(0, 3).some(s => s.composition.sugarGrams > 25);
    if (highSugar) {
      stories.push({ icon: "alert-circle" as const, iconColor: "#FF9800", title: "High Sugar Warning", message: "Some recent drinks spike your blood sugar within 20 minutes. Consider lower-sugar alternatives." });
    }
    const goodDrinks = state.scans.slice(0, 5).filter(s => s.impactScore >= 80).length;
    if (goodDrinks >= 2) {
      stories.push({ icon: "checkmark-circle" as const, iconColor: colors.scoreHigh, title: "Great Choices!", message: `${goodDrinks} of your recent drinks scored 80+. Your body thanks you!` });
    }
    if (stories.length < 2) {
      stories.push({ icon: "sparkles" as const, iconColor: colors.secondary, title: "AI Health Intelligence", message: "Scan drinks to get short, medium, and long-term health impact analysis." });
    }
    return stories.slice(0, 2);
  })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 20,
          gap: 22,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, fontWeight: "500" }}>
              {getGreeting()}
            </Text>
            <Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "800", fontFamily: "Inter_700Bold", marginTop: 2 }}>
              Liquid Impact
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {xpTotal > 0 && (
              <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: `${colors.secondary}18`, borderWidth: 1, borderColor: `${colors.secondary}30` }}>
                <Text style={{ color: colors.secondary, fontSize: 12, fontWeight: "700" }}>{xpTotal} XP</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: `${colors.scoreMedium}18`, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: `${colors.scoreMedium}30` }}>
              <Ionicons name="flame" size={15} color={colors.scoreMedium} />
              <Text style={{ color: colors.scoreMedium, fontSize: 14, fontWeight: "800" }}>{state.streak}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <QuickActionButton
            icon="camera"
            title="Scan Now"
            color={colors.primary}
            onPress={handleScan}
            badge={!canScan ? "!" : undefined}
          />
          <QuickActionButton
            icon="trophy"
            title={state.subscription === "free" ? "Go Pro" : "Plan"}
            color="#FFD700"
            onPress={() => router.push("/paywall")}
          />
          <QuickActionButton
            icon="pulse"
            title="Status"
            color={colors.secondary}
            onPress={() => router.push("/(tabs)/status")}
          />
          <QuickActionButton
            icon="settings"
            title="Settings"
            color={colors.mutedForeground}
            onPress={() => router.push("/settings")}
          />
        </View>

        {/* Scan Limit Banner (if free/starter near limit) */}
        {!canScan && (
          <TouchableOpacity
            onPress={() => router.push("/paywall")}
            activeOpacity={0.85}
            style={{ borderRadius: 18, overflow: "hidden" }}
          >
            <LinearGradient
              colors={["rgba(255,107,157,0.12)", "rgba(123,44,191,0.12)"]}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: `${colors.accent}30` }}
            >
              <Ionicons name="lock-closed" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>Daily limit reached</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 1 }}>Upgrade to keep scanning</Text>
              </View>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>Upgrade →</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Weekly Score Card */}
        <GlassCard>
          <View style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>
              Weekly Average Score
            </Text>
            <ScoreRing score={avgScore} size={160} strokeWidth={14} />
            <View style={{ flexDirection: "row", gap: 14, marginTop: 20 }}>
              {weeklyScores.slice(0, 7).map((d, i) => (
                <View key={i} style={{ alignItems: "center", gap: 4 }}>
                  <View style={{ width: 6, height: Math.max(4, (d.score / 100) * 32), borderRadius: 3, backgroundColor: d.score >= 80 ? colors.scoreHigh : d.score >= 50 ? colors.scoreMedium : d.score > 0 ? colors.scoreLow : colors.border }} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>{d.shortDay}</Text>
                </View>
              ))}
            </View>
          </View>
        </GlassCard>

        {/* Stats Row */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard icon="scan-outline" iconColor={colors.primary} title="Total Scans" value={String(state.scans.length)} />
          <StatCard icon="star" iconColor={colors.scoreMedium} title="Avg Score" value={avgScore > 0 ? String(avgScore) : "—"}
            valueColor={avgScore >= 80 ? colors.scoreHigh : avgScore >= 50 ? colors.scoreMedium : avgScore > 0 ? colors.scoreLow : colors.foreground} />
          <StatCard icon="flame" iconColor={colors.scoreMedium} title="Streak" value={`${state.streak}d`} valueColor={colors.scoreMedium} />
        </View>

        {/* Body Status */}
        {state.scans.length > 0 && (
          <GlassCard gradient>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="body" size={16} color={colors.primary} />
                <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" }}>Body Status Today</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {[
                  { label: "Hydration", value: dailyStatus.hydration, color: colors.primary },
                  { label: "Energy", value: dailyStatus.energy, color: colors.scoreMedium },
                  { label: "Recovery", value: dailyStatus.recovery, color: colors.scoreHigh },
                  { label: "Focus", value: dailyStatus.focus, color: colors.secondary },
                ].map((m) => (
                  <View key={m.label} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                    <View style={{ width: "100%", height: 6, backgroundColor: colors.backgroundTertiary, borderRadius: 3, overflow: "hidden" }}>
                      <View style={{ width: `${m.value}%`, height: "100%", backgroundColor: m.color, borderRadius: 3 }} />
                    </View>
                    <Text style={{ color: m.color, fontSize: 13, fontWeight: "700" }}>{m.value > 0 ? `${m.value}%` : "—"}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>{m.label}</Text>
                  </View>
                ))}
              </View>
              {dailyStatus.dehydrationRisk && (
                <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "600" }}>
                  ⚠️ {dailyStatus.recommendation}
                </Text>
              )}
            </View>
          </GlassCard>
        )}

        {/* Scan CTA */}
        <TouchableOpacity onPress={handleScan} activeOpacity={0.85} style={{ borderRadius: 28, overflow: "hidden" }}>
          <LinearGradient colors={["#FF6B9D", "#7B2CBF", "#00B4D8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 20 }}>
            <Ionicons name="camera" size={24} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", fontFamily: "Inter_700Bold" }}>Scan Your Drink</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Impact Stories */}
        <View style={{ gap: 10 }}>
          <SectionHeader title="Impact Stories" />
          {impactStories.map((story, i) => (
            <ImpactStoryCard key={i} {...story} />
          ))}
        </View>

        {/* Recent Scans */}
        <View style={{ gap: 12 }}>
          <SectionHeader
            title="Recent Scans"
            action={state.scans.length > 3 ? { label: "See All", onPress: () => router.push("/(tabs)/history") } : undefined}
          />
          {recentScans.length > 0 ? (
            recentScans.map((scan) => (
              <DrinkCard key={scan.id} scan={scan} onPress={() => router.push(`/report?id=${scan.id}`)} />
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
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryDim, justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="sparkles" size={20} color={colors.primary} />
                </View>
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold" }}>Latest AI Insight</Text>
              </View>
              <Text style={{ color: colors.subtext, fontSize: 14, lineHeight: 22 }}>{state.scans[0].aiInsight}</Text>
              {state.scans[0].viralStatement && (
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600", fontStyle: "italic" }}>
                  "{state.scans[0].viralStatement}"
                </Text>
              )}
            </View>
          </GlassCard>
        )}

        {/* Daily Missions */}
        <View style={{ gap: 12 }}>
          <SectionHeader title="Daily Missions" action={{ label: "View All", onPress: () => router.push("/(tabs)/profile") }} />
          {state.missions.slice(0, 3).map((m) => (
            <MissionRow key={m.id} mission={m} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
