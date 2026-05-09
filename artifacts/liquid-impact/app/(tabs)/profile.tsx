import React from "react";
import { ScrollView, Text, TouchableOpacity, View, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard } from "@/components/ui";

function SettingRow({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  badge,
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
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 14,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: `${iconColor}18`,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 1 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {badge && (
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            backgroundColor: `${colors.primary}18`,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
            {badge}
          </Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function Divider() {
  const colors = useColors();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.border,
        marginLeft: 54,
      }}
    />
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, avgScore } = useApp();

  const tierLabel =
    state.subscription === "free"
      ? "Free"
      : state.subscription === "starter"
      ? "Starter"
      : state.subscription === "pro"
      ? "Pro"
      : "Elite";

  const tierColor =
    state.subscription === "free"
      ? colors.mutedForeground
      : state.subscription === "elite"
      ? "#FFD700"
      : colors.primary;

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
        {/* Avatar */}
        <View style={{ alignItems: "center", gap: 12, paddingTop: 8 }}>
          <View style={{ borderRadius: 52, overflow: "hidden", padding: 3 }}>
            <LinearGradient
              colors={["#00B4D8", "#7B2CBF"]}
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="person" size={44} color="#fff" />
            </LinearGradient>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "800",
                fontFamily: "Inter_700Bold",
              }}
            >
              Health Explorer
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 4,
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 10,
                backgroundColor: `${tierColor}18`,
              }}
            >
              <Ionicons
                name={state.subscription === "free" ? "person-outline" : "crown"}
                size={12}
                color={tierColor}
              />
              <Text style={{ color: tierColor, fontSize: 12, fontWeight: "700" }}>
                {tierLabel} Plan
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { label: "Total Scans", value: String(state.scans.length), color: colors.primary },
            { label: "Day Streak", value: `${state.streak}`, color: colors.scoreMedium },
            { label: "Avg Score", value: avgScore > 0 ? String(avgScore) : "—", color: colors.scoreHigh },
            { label: "Best Streak", value: `${state.longestStreak}`, color: colors.secondary },
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
                  fontSize: 20,
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

        {/* Upgrade card (if free) */}
        {state.subscription === "free" && (
          <TouchableOpacity
            onPress={() => router.push("/paywall")}
            activeOpacity={0.85}
            style={{ borderRadius: 24, overflow: "hidden" }}
          >
            <LinearGradient
              colors={["rgba(0,180,216,0.15)", "rgba(123,44,191,0.15)"]}
              style={{
                padding: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: `${colors.primary}30`,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: "rgba(255,215,0,0.15)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons name="crown" size={22} color="#FFD700" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 15,
                    fontWeight: "700",
                    fontFamily: "Inter_700Bold",
                  }}
                >
                  Upgrade to Pro
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                  Unlimited scans + full analysis
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Missions summary */}
        <GlassCard>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 16,
              fontWeight: "700",
              fontFamily: "Inter_700Bold",
              marginBottom: 12,
            }}
          >
            Today's Missions
          </Text>
          {state.missions.map((m) => (
            <View
              key={m.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 6,
              }}
            >
              <Ionicons
                name={m.completed ? "checkmark-circle" : "radio-button-off"}
                size={20}
                color={m.completed ? colors.success : colors.mutedForeground}
              />
              <Text
                style={{
                  flex: 1,
                  color: m.completed ? colors.success : colors.subtext,
                  fontSize: 13,
                  fontWeight: m.completed ? "700" : "500",
                  textDecorationLine: m.completed ? "line-through" : "none",
                }}
              >
                {m.title}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                +{m.xp} XP
              </Text>
            </View>
          ))}
        </GlassCard>

        {/* Settings */}
        <GlassCard padding={4}>
          <View style={{ paddingHorizontal: 12 }}>
            <SettingRow
              icon="notifications"
              iconColor={colors.primary}
              title="Notifications"
              subtitle="Daily reminders and insights"
            />
            <Divider />
            <SettingRow
              icon="shield-checkmark"
              iconColor={colors.secondary}
              title="Privacy"
              subtitle="Data and permissions"
            />
            <Divider />
            <SettingRow
              icon="help-circle"
              iconColor={colors.scoreMedium}
              title="Help & Support"
            />
            <Divider />
            <SettingRow
              icon="document-text"
              iconColor={colors.scoreHigh}
              title="Terms of Service"
            />
            <Divider />
            <SettingRow
              icon="star"
              iconColor="#FFD700"
              title="Rate the App"
              badge="New"
            />
          </View>
        </GlassCard>

        {/* Version */}
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Liquid Impact v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}
