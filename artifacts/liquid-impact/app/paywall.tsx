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
import { useApp, SUBSCRIPTION_LIMITS } from "@/context/AppContext";
import type { SubscriptionTier } from "@/types";

type BillingCycle = "monthly" | "yearly";

interface TierConfig {
  id: SubscriptionTier;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  monthlyPrice: string;
  yearlyPrice: string;
  yearlySavings: string;
  highlighted: boolean;
  badge?: string;
  features: string[];
  scanLimit: string;
}

const TIERS: TierConfig[] = [
  {
    id: "free",
    name: "Free",
    icon: "water-outline",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    yearlySavings: "",
    highlighted: false,
    features: ["3 scans per day", "Basic impact score", "Hydration level", "Short-term insights"],
    scanLimit: "3/day",
  },
  {
    id: "starter",
    name: "Starter",
    icon: "flash",
    monthlyPrice: "$3.99",
    yearlyPrice: "$24.99",
    yearlySavings: "Save 48%",
    highlighted: false,
    features: ["100 scans per month", "Full score + ingredients", "Short-term insights", "Ad-free experience"],
    scanLimit: "100/month",
  },
  {
    id: "pro",
    name: "Pro",
    icon: "trophy",
    monthlyPrice: "$7.99",
    yearlyPrice: "$49.99",
    yearlySavings: "Save 48%",
    highlighted: true,
    badge: "Best Value",
    features: [
      "Unlimited scans",
      "Medium + Long-term modeling",
      "Glycemic impact detection",
      "Additive & sweetener analysis",
      "Weekly trends & export",
      "Smart alternatives",
    ],
    scanLimit: "Unlimited",
  },
  {
    id: "elite",
    name: "Elite",
    icon: "sparkles",
    monthlyPrice: "$14.99",
    yearlyPrice: "$99.99",
    yearlySavings: "Save 44%",
    highlighted: false,
    features: [
      "Everything in Pro",
      "Advanced AI reasoning",
      "Personalized insights",
      "Habit prediction model",
      "Content generation",
      "Priority support",
    ],
    scanLimit: "Unlimited",
  },
  {
    id: "family",
    name: "Family",
    icon: "people",
    monthlyPrice: "$19.99",
    yearlyPrice: "$119.99",
    yearlySavings: "Save 50%",
    highlighted: false,
    features: [
      "4 accounts included",
      "All Pro features for each",
      "Family progress tracking",
      "Shared health insights",
      "Priority support",
    ],
    scanLimit: "Unlimited",
  },
];

function tierColor(id: SubscriptionTier): string {
  switch (id) {
    case "free": return "#6B6B80";
    case "starter": return "#00B4D8";
    case "pro": return "#7B2CBF";
    case "elite": return "#FFD700";
    case "family": return "#FF6B9D";
  }
}

export default function PaywallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, setSubscription } = useApp();
  const [selected, setSelected] = useState<SubscriptionTier>(
    state.subscription === "free" ? "pro" : state.subscription,
  );
  const [billing, setBilling] = useState<BillingCycle>("yearly");

  const selectedTier = TIERS.find((t) => t.id === selected)!;
  const tc = tierColor(selected);

  const handleSubscribe = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubscription(selected);
    router.back();
  };

  const price = billing === "monthly" ? selectedTier.monthlyPrice : selectedTier.yearlyPrice;
  const period = billing === "monthly" ? "/month" : "/year";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ position: "absolute", top: insets.top + 12, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" }}
      >
        <Ionicons name="close" size={18} color="#fff" />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32, paddingHorizontal: 20, gap: 20 }}
      >
        {/* Header */}
        <View style={{ alignItems: "center", gap: 8 }}>
          <LinearGradient colors={["#00B4D8", "#7B2CBF"]}
            style={{ width: 64, height: 64, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 4 }}>
            <Ionicons name="sparkles" size={30} color="#fff" />
          </LinearGradient>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Unlock Full Power</Text>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "800", fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 30 }}>
            See exactly what your{"\n"}drinks do to your body
          </Text>
        </View>

        {/* Billing toggle */}
        <View style={{ flexDirection: "row", backgroundColor: colors.backgroundSecondary, borderRadius: 14, padding: 4 }}>
          {(["monthly", "yearly"] as BillingCycle[]).map((c) => (
            <TouchableOpacity
              key={c}
              onPress={async () => { setBilling(c); await Haptics.selectionAsync(); }}
              activeOpacity={0.8}
              style={{
                flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10,
                backgroundColor: billing === c ? colors.primaryDim : "transparent",
                borderWidth: billing === c ? 1 : 0,
                borderColor: billing === c ? `${colors.primary}40` : "transparent",
              }}
            >
              <Text style={{ color: billing === c ? colors.primary : colors.mutedForeground, fontSize: 14, fontWeight: "700" }}>
                {c === "monthly" ? "Monthly" : "Yearly"}
              </Text>
              {c === "yearly" && (
                <Text style={{ color: colors.success, fontSize: 10, fontWeight: "700" }}>Save up to 50%</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tier cards */}
        {TIERS.map((tier) => {
          const isSelected = selected === tier.id;
          const tc2 = tierColor(tier.id);
          const price2 = billing === "monthly" ? tier.monthlyPrice : tier.yearlyPrice;
          return (
            <TouchableOpacity
              key={tier.id}
              onPress={async () => { setSelected(tier.id); await Haptics.selectionAsync(); }}
              activeOpacity={0.85}
              style={{
                borderRadius: 24, padding: 18,
                backgroundColor: tier.highlighted ? "rgba(123,44,191,0.07)" : `${colors.backgroundSecondary}CC`,
                borderWidth: tier.highlighted || isSelected ? 2 : 1,
                borderColor: isSelected ? tc2 : tier.highlighted ? `${tc2}50` : colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: `${tc2}18`, borderWidth: 1, borderColor: `${tc2}30`, justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name={tier.icon} size={22} color={tc2} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800", fontFamily: "Inter_700Bold" }}>{tier.name}</Text>
                    {tier.badge && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.successDim, borderWidth: 1, borderColor: `${colors.success}30` }}>
                        <Text style={{ color: colors.success, fontSize: 10, fontWeight: "700" }}>{tier.badge}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
                    <Text style={{ color: tc2, fontSize: 22, fontWeight: "800", fontFamily: "Inter_700Bold" }}>{price2}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {tier.id === "free" ? "forever" : billing === "monthly" ? "/month" : "/year"}
                    </Text>
                  </View>
                  {billing === "yearly" && tier.yearlySavings && (
                    <Text style={{ color: colors.success, fontSize: 11, fontWeight: "600", marginTop: 2 }}>{tier.yearlySavings}</Text>
                  )}
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                    {tier.scanLimit} scans
                  </Text>
                </View>
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isSelected ? tc2 : "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" }}>
                  {isSelected && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tc2 }} />}
                </View>
              </View>

              {isSelected && (
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
              )}
            </TouchableOpacity>
          );
        })}

        {/* CTA */}
        <TouchableOpacity onPress={handleSubscribe} activeOpacity={0.85} style={{ borderRadius: 24, overflow: "hidden" }}>
          <LinearGradient
            colors={selected === "free" ? ["#3A3A4A", "#3A3A4A"] : [tc, tc === "#FFD700" ? "#FF9800" : "#00B4D8"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 18, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800", fontFamily: "Inter_700Bold" }}>
              {selected === "free"
                ? "Continue with Free"
                : `Get ${selectedTier.name} — ${price}${period}`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Trust */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 24 }}>
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

        <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "center" }}>
          Cancel anytime • Payments processed securely • 7-day free trial on paid plans
        </Text>
      </ScrollView>
    </View>
  );
}
