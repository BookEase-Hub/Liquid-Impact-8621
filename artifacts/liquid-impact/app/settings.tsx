import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useApp, SUBSCRIPTION_LIMITS } from "@/context/AppContext";
import { GlassCard } from "@/components/ui";

function SettingRow({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  const content = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 }}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: `${iconColor}18`, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>{title}</Text>
        {subtitle && <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 1 }}>{subtitle}</Text>}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={15} color={colors.mutedForeground} />}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

function Divider() {
  const colors = useColors();
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 52 }} />;
}

function SectionLabel({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 8, marginBottom: 4, paddingHorizontal: 4 }}>
      {title}
    </Text>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useApp();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(true);

  const tierInfo = SUBSCRIPTION_LIMITS[state.subscription];

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace("/onboarding");
          },
        },
      ],
    );
  };

  const handleResetData = () => {
    Alert.alert(
      "Reset App Data",
      "This will clear all your scan history and reset the app. Your subscription won't be affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("@liquid_impact_v2");
            router.replace("/onboarding");
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.backgroundSecondary, justifyContent: "center", alignItems: "center" }}
        >
          <Ionicons name="chevron-back" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "800", fontFamily: "Inter_700Bold" }}>Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, paddingTop: 20, gap: 6 }}
      >
        {/* Subscription */}
        <SectionLabel title="Subscription" />
        <GlassCard style={{ borderColor: `${colors.primary}20` }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primaryDim, justifyContent: "center", alignItems: "center" }}>
              <Ionicons name="trophy" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800", fontFamily: "Inter_700Bold" }}>
                {tierInfo.label} Plan
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                {tierInfo.daily !== null
                  ? `${tierInfo.daily} scans/day`
                  : tierInfo.monthly !== null
                  ? `${tierInfo.monthly} scans/month`
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

        {/* Account */}
        <SectionLabel title="Account" />
        <GlassCard padding={4}>
          <View style={{ paddingHorizontal: 12 }}>
            <SettingRow icon="person-circle" iconColor={colors.primary} title="Edit Profile" subtitle="Name, avatar, email" />
            <Divider />
            <SettingRow icon="lock-closed" iconColor={colors.secondary} title="Change Password" />
            <Divider />
            <SettingRow icon="card" iconColor={colors.scoreHigh} title="Billing & Payments" subtitle="Manage payment methods" />
          </View>
        </GlassCard>

        {/* Preferences */}
        <SectionLabel title="Preferences" />
        <GlassCard padding={4}>
          <View style={{ paddingHorizontal: 12 }}>
            <SettingRow
              icon="notifications"
              iconColor={colors.primary}
              title="Push Notifications"
              subtitle="Daily reminders and insights"
              right={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: colors.backgroundTertiary, true: `${colors.primary}60` }}
                  thumbColor={notificationsEnabled ? colors.primary : colors.mutedForeground}
                />
              }
            />
            <Divider />
            <SettingRow
              icon="newspaper"
              iconColor={colors.secondary}
              title="Weekly Health Digest"
              subtitle="Summary of your week"
              right={
                <Switch
                  value={weeklyDigestEnabled}
                  onValueChange={setWeeklyDigestEnabled}
                  trackColor={{ false: colors.backgroundTertiary, true: `${colors.secondary}60` }}
                  thumbColor={weeklyDigestEnabled ? colors.secondary : colors.mutedForeground}
                />
              }
            />
            <Divider />
            <SettingRow icon="language" iconColor={colors.scoreMedium} title="Language" subtitle="English" />
            <Divider />
            <SettingRow icon="scale" iconColor={colors.scoreHigh} title="Units" subtitle="Metric (ml, g, mg)" />
          </View>
        </GlassCard>

        {/* Privacy */}
        <SectionLabel title="Privacy & Data" />
        <GlassCard padding={4}>
          <View style={{ paddingHorizontal: 12 }}>
            <SettingRow icon="shield-checkmark" iconColor={colors.scoreHigh} title="Privacy Policy" />
            <Divider />
            <SettingRow icon="document-text" iconColor={colors.primary} title="Terms of Service" />
            <Divider />
            <SettingRow
              icon="analytics"
              iconColor={colors.secondary}
              title="Analytics & Crash Reports"
              subtitle="Help improve the app"
              right={<Switch value={true} trackColor={{ false: colors.backgroundTertiary, true: `${colors.secondary}60` }} thumbColor={colors.secondary} />}
            />
            <Divider />
            <SettingRow
              icon="refresh-circle"
              iconColor={colors.scoreMedium}
              title="Reset App Data"
              subtitle="Clear scan history and settings"
              onPress={handleResetData}
            />
          </View>
        </GlassCard>

        {/* Support */}
        <SectionLabel title="Support" />
        <GlassCard padding={4}>
          <View style={{ paddingHorizontal: 12 }}>
            <SettingRow icon="help-circle" iconColor={colors.primary} title="Help Center" />
            <Divider />
            <SettingRow icon="chatbubble-ellipses" iconColor={colors.secondary} title="Contact Us" subtitle="support@liquidimpact.app" />
            <Divider />
            <SettingRow icon="star" iconColor="#FFD700" title="Rate the App" />
            <Divider />
            <SettingRow icon="share-social" iconColor={colors.scoreHigh} title="Share with Friends" />
          </View>
        </GlassCard>

        {/* App info */}
        <GlassCard>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Version</Text>
            <Text style={{ color: colors.subtext, fontSize: 13, fontWeight: "600" }}>1.0.0</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Build</Text>
            <Text style={{ color: colors.subtext, fontSize: 13, fontWeight: "600" }}>2026.01</Text>
          </View>
        </GlassCard>

        {/* Danger zone */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          activeOpacity={0.8}
          style={{ borderRadius: 20, padding: 16, backgroundColor: `${colors.danger}0D`, borderWidth: 1, borderColor: `${colors.danger}25`, alignItems: "center" }}
        >
          <Text style={{ color: colors.danger, fontSize: 15, fontWeight: "700" }}>Delete Account</Text>
          <Text style={{ color: `${colors.danger}80`, fontSize: 12, marginTop: 2 }}>Permanently delete all data</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
