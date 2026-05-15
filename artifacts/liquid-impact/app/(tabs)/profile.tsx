import React, { useCallback } from "react";
import { Alert, Linking, Platform, ScrollView, Share, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as StoreReview from "expo-store-review";
import { useColors } from "@/hooks/useColors";
import { useApp, SUBSCRIPTION_LIMITS } from "@/context/AppContext";
import { GlassCard, MissionRow, SectionHeader } from "@/components/ui";

function tierIcon(tier: string): keyof typeof Ionicons.glyphMap {
  switch (tier) {
    case "starter": return "flash";
    case "pro": return "trophy";
    case "elite": return "sparkles";
    case "family": return "people";
    default: return "water-outline";
  }
}

function SettingRow({
  icon, iconColor, title, subtitle, onPress, badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  badge?: string;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${iconColor}18`, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>{title}</Text>
        {subtitle && <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 1 }}>{subtitle}</Text>}
      </View>
      {badge && (
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${colors.primary}18` }}>
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 54 }} />;
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, avgScore, xpTotal, todayScanCount, monthScanCount } = useApp();

  const handleRateApp = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const hasAction = await StoreReview.hasAction();
      if (hasAction) {
        await StoreReview.requestReview();
      } else {
        const url =
          Platform.OS === "ios"
            ? "https://apps.apple.com/app/liquid-impact"
            : "https://play.google.com/store/apps/details?id=com.liquidimpact.app";
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert("Rate App", "Thank you for your support! 🌟");
    }
  }, []);

  const tierInfo = SUBSCRIPTION_LIMITS[state.subscription];
  const tc = (() => {
    switch (state.subscription) {
      case "starter": return colors.primary;
      case "pro": return colors.secondary;
      case "elite": return "#FFD700";
      case "family": return "#FF6B9D";
      default: return colors.mutedForeground;
    }
  })();

  const completedMissions = state.missions.filter((m) => m.completed).length;

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
      >
        {/* Avatar + Name */}
        <View style={{ alignItems: "center", gap: 14, paddingTop: 8 }}>
          <View style={{ padding: 3, borderRadius: 52, overflow: "hidden" }}>
            <LinearGradient colors={["#00B4D8", "#7B2CBF"]}
              style={{ width: 96, height: 96, borderRadius: 48, justifyContent: "center", alignItems: "center" }}>
              <Ionicons name="person" size={44} color="#fff" />
            </LinearGradient>
          </View>
          <View style={{ alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "800", fontFamily: "Inter_700Bold" }}>
              Health Explorer
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, backgroundColor: `${tc}14`, borderWidth: 1, borderColor: `${tc}25` }}>
              <Ionicons name={tierIcon(state.subscription)} size={13} color={tc} />
              <Text style={{ color: tc, fontSize: 13, fontWeight: "700" }}>{tierInfo.label} Plan</Text>
            </View>
            {xpTotal > 0 && (
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{xpTotal} XP earned today</Text>
            )}
          </View>
        </View>

        {/* Stats Row */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { label: "Total Scans", value: String(state.scans.length), color: colors.primary },
            { label: "Day Streak", value: `${state.streak}`, color: colors.scoreMedium },
            { label: "Avg Score", value: avgScore > 0 ? String(avgScore) : "—", color: colors.scoreHigh },
            { label: "Best Streak", value: `${state.longestStreak}`, color: colors.secondary },
          ].map((s) => (
            <View key={s.label} style={{ flex: 1, backgroundColor: colors.backgroundSecondary, borderRadius: 16, padding: 10, alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: s.color, fontSize: 20, fontWeight: "800", fontFamily: "Inter_700Bold" }}>{s.value}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 9, textAlign: "center" }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Subscription info */}
        <GlassCard style={{ borderColor: `${tc}25` }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: `${tc}14`, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: `${tc}25` }}>
              <Ionicons name={tierIcon(state.subscription)} size={24} color={tc} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800", fontFamily: "Inter_700Bold" }}>
                {tierInfo.label} Plan
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                {tierInfo.daily !== null
                  ? `${todayScanCount}/${tierInfo.daily} scans today`
                  : tierInfo.monthly !== null
                  ? `${monthScanCount}/${tierInfo.monthly} scans this month`
                  : "Unlimited scans"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/paywall")}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: `${colors.primary}30` }}
            >
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                {state.subscription === "free" ? "Upgrade" : "Manage"}
              </Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Upgrade card (free only) */}
        {state.subscription === "free" && (
          <TouchableOpacity onPress={() => router.push("/paywall")} activeOpacity={0.85} style={{ borderRadius: 24, overflow: "hidden" }}>
            <LinearGradient
              colors={["rgba(0,180,216,0.12)", "rgba(123,44,191,0.12)"]}
              style={{ padding: 20, flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 24, borderWidth: 1, borderColor: `${colors.primary}25` }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,215,0,0.15)", justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="trophy" size={22} color="#FFD700" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" }}>Upgrade to Pro</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>Unlimited scans + full analysis from $7.99/mo</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Missions */}
        <View style={{ gap: 12 }}>
          <SectionHeader
            title="Daily Missions"
            action={{ label: `${completedMissions}/${state.missions.length} done`, onPress: () => {} }}
          />
          {state.missions.map((m) => (
            <MissionRow key={m.id} mission={m} />
          ))}
        </View>

        {/* Settings */}
        <GlassCard padding={4}>
          <View style={{ paddingHorizontal: 12 }}>
            <SettingRow
              icon="settings"
              iconColor={colors.primary}
              title="Settings"
              subtitle="Preferences, privacy, account"
              onPress={() => router.push("/settings")}
            />
            <Divider />
            <SettingRow
              icon="notifications"
              iconColor={colors.secondary}
              title="Notifications"
              subtitle="Reminders and insights"
              onPress={() => router.push("/settings")}
            />
            <Divider />
            <SettingRow
              icon="shield-checkmark"
              iconColor={colors.scoreHigh}
              title="Privacy & Data"
              onPress={() => router.push("/settings")}
            />
            <Divider />
            <SettingRow
              icon="help-circle"
              iconColor={colors.scoreMedium}
              title="Help & Support"
            />
            <Divider />
            <SettingRow
              icon="star"
              iconColor="#FFD700"
              title="Rate the App"
              badge="New"
              onPress={handleRateApp}
            />
          </View>
        </GlassCard>

        <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center" }}>
          Liquid Impact v1.0.0 · Made with AI ✨
        </Text>
      </ScrollView>
    </View>
  );
}
