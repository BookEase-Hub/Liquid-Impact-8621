import React, { useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import type { SubscriptionTier } from "@/types";

interface TierOption {
  id: SubscriptionTier;
  name: string;
  price: string;
  period: string;
  badge?: string;
  icon: keyof typeof Ionicons.glyphMap;
  highlighted: boolean;
  features: string[];
}

const TIERS: TierOption[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    icon: "person-outline",
    highlighted: false,
    features: ["5 scans per day", "Basic impact score", "7-day history"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$1.99",
    period: "/month",
    icon: "star-outline",
    highlighted: false,
    features: ["20 scans per day", "Full ingredient analysis", "30-day history", "AI insights"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$11.99",
    period: "/year",
    badge: "Best Value",
    icon: "flash",
    highlighted: true,
    features: [
      "Unlimited scans",
      "Full AI health report",
      "Unlimited history",
      "Timeline impact analysis",
      "Body status tracking",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: "$29.99",
    period: "/year",
    icon: "crown",
    highlighted: false,
    features: [
      "Everything in Pro",
      "Personalized AI coaching",
      "Weekly health digest",
      "Priority support",
    ],
  },
];

export default function PaywallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, setSubscription } = useApp();
  const [selected, setSelected] = useState<SubscriptionTier>(
    state.subscription === "free" ? "pro" : state.subscription
  );

  const handleSubscribe = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubscription(selected);
    router.back();
  };

  const selectedTier = TIERS.find((t) => t.id === selected)!;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          position: "absolute",
          top: insets.top + 12,
          right: 20,
          zIndex: 10,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "rgba(255,255,255,0.1)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons name="close" size={18} color="#fff" />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
          gap: 20,
        }}
      >
        {/* Header */}
        <View style={{ alignItems: "center", gap: 8 }}>
          <LinearGradient
            colors={["#00B4D8", "#7B2CBF"]}
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Ionicons name="sparkles" size={30} color="#fff" />
          </LinearGradient>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
            Unlock Full Power
          </Text>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 26,
              fontWeight: "800",
              fontFamily: "Inter_700Bold",
              textAlign: "center",
              lineHeight: 32,
            }}
          >
            See exactly what your{"\n"}drinks do to your body
          </Text>
        </View>

        {/* Tiers */}
        {TIERS.map((tier) => {
          const isSelected = selected === tier.id;
          const tColor = tier.highlighted ? colors.primary : isSelected ? colors.primary : colors.mutedForeground;

          return (
            <TouchableOpacity
              key={tier.id}
              onPress={async () => {
                setSelected(tier.id);
                await Haptics.selectionAsync();
              }}
              activeOpacity={0.85}
              style={{
                borderRadius: 24,
                padding: 20,
                backgroundColor: tier.highlighted
                  ? "rgba(0,180,216,0.06)"
                  : `${colors.backgroundSecondary}99`,
                borderWidth: tier.highlighted || isSelected ? 2 : 1,
                borderColor: tier.highlighted
                  ? `${colors.primary}50`
                  : isSelected
                  ? `${colors.primary}40`
                  : colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: `${tColor}18`,
                    borderWidth: 1,
                    borderColor: `${tColor}30`,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Ionicons name={tier.icon} size={22} color={tColor} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800", fontFamily: "Inter_700Bold" }}>
                      {tier.name}
                    </Text>
                    {tier.badge && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.successDim, borderWidth: 1, borderColor: `${colors.success}30` }}>
                        <Text style={{ color: colors.success, fontSize: 10, fontWeight: "700" }}>
                          {tier.badge}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                    <Text style={{ color: tColor, fontSize: 24, fontWeight: "800", fontFamily: "Inter_700Bold" }}>
                      {tier.price}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                      {tier.period}
                    </Text>
                  </View>
                </View>

                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isSelected ? colors.primary : "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" }}>
                  {isSelected && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />}
                </View>
              </View>

              <View style={{ marginTop: 14, gap: 8 }}>
                {tier.features.map((f) => (
                  <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.successDim, justifyContent: "center", alignItems: "center" }}>
                      <Ionicons name="checkmark" size={10} color={colors.success} />
                    </View>
                    <Text style={{ color: colors.subtext, fontSize: 13 }}>{f}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* CTA */}
        <TouchableOpacity
          onPress={handleSubscribe}
          activeOpacity={0.85}
          style={{ borderRadius: 24, overflow: "hidden" }}
        >
          <LinearGradient
            colors={["#00B4D8", "#7B2CBF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 18,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800", fontFamily: "Inter_700Bold" }}>
              {selected === "free"
                ? "Continue with Free"
                : `Get ${selectedTier.name} — ${selectedTier.price}${selectedTier.period}`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Trust indicators */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 20 }}>
          {[
            { icon: "shield-checkmark" as const, label: "Secure" },
            { icon: "card" as const, label: "Easy cancel" },
            { icon: "refresh" as const, label: "7-day trial" },
          ].map((item) => (
            <View key={item.label} style={{ alignItems: "center", gap: 4 }}>
              <Ionicons name={item.icon} size={16} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
