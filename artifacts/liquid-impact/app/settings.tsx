import React, { useState, useCallback, useEffect } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  Share,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as StoreReview from "expo-store-review";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useApp, SUBSCRIPTION_LIMITS } from "@/context/AppContext";
import { useAuthStore } from "@/features/auth/store";
import { GlassCard } from "@/components/ui";

function SectionLabel({ title }: { title: string }) {
  const C = useColors();
  return (
    <Text
      style={{
        color: C.mutedForeground,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.8,
        textTransform: "uppercase",
        marginTop: 20,
        marginBottom: 8,
        paddingHorizontal: 4,
      }}
    >
      {title}
    </Text>
  );
}

function Divider() {
  const C = useColors();
  return <View style={{ height: 1, backgroundColor: C.border, marginLeft: 54 }} />;
}

function SettingRow({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  right,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  const C = useColors();

  const handlePress = useCallback(() => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  }, [onPress]);

  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 15,
        paddingHorizontal: 4,
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
        <Text
          style={{
            color: destructive ? C.danger : C.foreground,
            fontSize: 15,
            fontWeight: "600",
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={{ color: C.mutedForeground, fontSize: 12, marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {right ?? (
        onPress && <Ionicons name="chevron-forward" size={15} color={C.mutedForeground} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

export default function SettingsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useApp();
  const { signOut } = useAuthStore();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  const tierInfo = SUBSCRIPTION_LIMITS[state.subscription];

  useEffect(() => {
    AsyncStorage.multiGet([
      "@settings_notifications",
      "@settings_weekly_digest",
      "@settings_analytics",
    ]).then(([[, n], [, w], [, a]]) => {
      if (n !== null) setNotificationsEnabled(JSON.parse(n));
      if (w !== null) setWeeklyDigestEnabled(JSON.parse(w));
      if (a !== null) setAnalyticsEnabled(JSON.parse(a));
    });
  }, []);

  const persist = useCallback(
    (key: string, value: boolean) =>
      AsyncStorage.setItem(key, JSON.stringify(value)),
    [],
  );

  const handleSignOut = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          try {
            await signOut();
            router.replace("/auth");
          } catch {
            Alert.alert("Error", "Failed to sign out. Please try again.");
          }
        },
      },
    ]);
  }, [signOut, router]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            await AsyncStorage.clear();
            router.replace("/auth");
          },
        },
      ],
    );
  }, [router]);

  const handleResetData = useCallback(() => {
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
  }, [router]);

  const handleRateApp = useCallback(async () => {
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

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message:
          "I use Liquid Impact to track what I drink 🌊 Check it out! https://liquidimpact.app",
        url: "https://liquidimpact.app",
      });
    } catch {
      /* dismissed */
    }
  }, []);

  const handleContactUs = useCallback(async () => {
    const url = "mailto:support@liquidimpact.app?subject=Liquid%20Impact%20Support";
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        "Contact Us",
        "Reach us at support@liquidimpact.app",
        [{ text: "OK" }],
      );
    }
  }, []);

  const toggle = (color: string, value: boolean, onChange: (v: boolean) => void, key: string) => (
    <Switch
      value={value}
      onValueChange={(v) => { onChange(v); persist(key, v); }}
      trackColor={{ false: C.backgroundTertiary, true: `${color}60` }}
      thumbColor={value ? color : C.mutedForeground}
      ios_backgroundColor={C.backgroundTertiary}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: C.backgroundSecondary,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="chevron-back" size={18} color={C.foreground} />
        </TouchableOpacity>
        <Text
          style={{
            color: C.foreground,
            fontSize: 22,
            fontWeight: "800",
          }}
        >
          Settings
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
          paddingTop: 8,
        }}
      >
        {/* Subscription */}
        <SectionLabel title="Subscription" />
        <GlassCard style={{ borderColor: `${C.primary}20` }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: C.primaryDim,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="trophy" size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.foreground, fontSize: 16, fontWeight: "800" }}>
                {tierInfo.label} Plan
              </Text>
              <Text style={{ color: C.mutedForeground, fontSize: 12, marginTop: 2 }}>
                {tierInfo.daily !== null
                  ? `${tierInfo.daily} scans/day`
                  : tierInfo.monthly !== null
                  ? `${tierInfo.monthly} scans/month`
                  : "Unlimited scans"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/paywall")}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: C.primaryDim,
                borderWidth: 1,
                borderColor: `${C.primary}30`,
              }}
            >
              <Text style={{ color: C.primary, fontSize: 13, fontWeight: "700" }}>
                {state.subscription === "free" ? "Upgrade" : "Manage"}
              </Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Account */}
        <SectionLabel title="Account" />
        <GlassCard padding={4}>
          <View style={{ paddingHorizontal: 12 }}>
            <SettingRow
              icon="person-circle"
              iconColor={C.primary}
              title="Edit Profile"
              subtitle="Name, avatar, display name"
              onPress={() => Alert.alert("Edit Profile", "Coming soon")}
            />
            <Divider />
            <SettingRow
              icon="lock-closed"
              iconColor={C.secondary}
              title="Change Password"
              onPress={() => router.push("/forgot-password")}
            />
            <Divider />
            <SettingRow
              icon="card"
              iconColor={C.scoreHigh}
              title="Billing & Payments"
              subtitle="Manage payment methods"
              onPress={() => router.push("/paywall")}
            />
          </View>
        </GlassCard>

        {/* Preferences */}
        <SectionLabel title="Preferences" />
        <GlassCard padding={4}>
          <View style={{ paddingHorizontal: 12 }}>
            <SettingRow
              icon="notifications"
              iconColor={C.primary}
              title="Push Notifications"
              subtitle="Daily reminders and insights"
              right={toggle(C.primary, notificationsEnabled, setNotificationsEnabled, "@settings_notifications")}
            />
            <Divider />
            <SettingRow
              icon="newspaper"
              iconColor={C.secondary}
              title="Weekly Health Digest"
              subtitle="Summary of your week"
              right={toggle(C.secondary, weeklyDigestEnabled, setWeeklyDigestEnabled, "@settings_weekly_digest")}
            />
            <Divider />
            <SettingRow
              icon="language"
              iconColor={C.scoreMedium}
              title="Language"
              subtitle="English"
              onPress={() => Alert.alert("Language", "More languages coming soon")}
            />
            <Divider />
            <SettingRow
              icon="scale"
              iconColor={C.scoreHigh}
              title="Units"
              subtitle="Metric (ml, g, mg)"
              onPress={() => Alert.alert("Units", "Unit selection coming soon")}
            />
          </View>
        </GlassCard>

        {/* Privacy & Data */}
        <SectionLabel title="Privacy & Data" />
        <GlassCard padding={4}>
          <View style={{ paddingHorizontal: 12 }}>
            <SettingRow
              icon="shield-checkmark"
              iconColor={C.scoreHigh}
              title="Privacy Policy"
              onPress={() => router.push("/privacy")}
            />
            <Divider />
            <SettingRow
              icon="document-text"
              iconColor={C.primary}
              title="Terms of Service"
              onPress={() => router.push("/terms")}
            />
            <Divider />
            <SettingRow
              icon="analytics"
              iconColor={C.secondary}
              title="Analytics & Crash Reports"
              subtitle="Help improve the app"
              right={toggle(C.secondary, analyticsEnabled, setAnalyticsEnabled, "@settings_analytics")}
            />
            <Divider />
            <SettingRow
              icon="refresh-circle"
              iconColor={C.scoreMedium}
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
            <SettingRow
              icon="help-circle"
              iconColor={C.primary}
              title="Help Center"
              onPress={() => Linking.openURL("https://liquidimpact.app/help")}
            />
            <Divider />
            <SettingRow
              icon="chatbubble-ellipses"
              iconColor={C.secondary}
              title="Contact Us"
              subtitle="support@liquidimpact.app"
              onPress={handleContactUs}
            />
            <Divider />
            <SettingRow
              icon="star"
              iconColor="#FFD700"
              title="Rate the App"
              subtitle="Share your feedback"
              onPress={handleRateApp}
            />
            <Divider />
            <SettingRow
              icon="share-social"
              iconColor={C.scoreHigh}
              title="Share with Friends"
              onPress={handleShare}
            />
          </View>
        </GlassCard>

        {/* App info */}
        <SectionLabel title="About" />
        <GlassCard>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <Text style={{ color: C.mutedForeground, fontSize: 13 }}>Version</Text>
            <Text style={{ color: C.subtext, fontSize: 13, fontWeight: "600" }}>1.0.0</Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 10,
            }}
          >
            <Text style={{ color: C.mutedForeground, fontSize: 13 }}>Build</Text>
            <Text style={{ color: C.subtext, fontSize: 13, fontWeight: "600" }}>2026.05</Text>
          </View>
        </GlassCard>

        {/* Sign Out */}
        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.8}
          style={{
            marginTop: 8,
            borderRadius: 20,
            padding: 16,
            backgroundColor: `${C.danger}0D`,
            borderWidth: 1,
            borderColor: `${C.danger}25`,
            alignItems: "center",
          }}
        >
          <Text style={{ color: C.danger, fontSize: 15, fontWeight: "700" }}>Sign Out</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          activeOpacity={0.8}
          style={{
            marginTop: 8,
            borderRadius: 20,
            padding: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: C.mutedForeground, fontSize: 13, fontWeight: "600" }}>
            Delete Account
          </Text>
          <Text style={{ color: `${C.mutedForeground}80`, fontSize: 11, marginTop: 2 }}>
            Permanently delete all data
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
