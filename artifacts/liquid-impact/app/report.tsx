import React, { useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { ScoreRing, GlassCard, statusColor, statusLabel } from "@/components/ui";
import type { ScanStatus } from "@/types";

type ImpactTab = "short" | "medium" | "long";

const TAB_LABELS: { key: ImpactTab; label: string }[] = [
  { key: "short", label: "Short-Term" },
  { key: "medium", label: "Medium" },
  { key: "long", label: "Long-Term" },
];

function ImpactRow({ label, value, color }: { label: string; value: string; color: string }) {
  const colors = useColors();
  return (
    <View style={{ gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ color: colors.subtext, fontSize: 14, lineHeight: 20 }}>
        {value}
      </Text>
    </View>
  );
}

export default function ReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState<ImpactTab>("short");

  const scan = state.scans.find((s) => s.id === id);

  if (!scan) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>Report not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontSize: 14 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sColor = statusColor(scan.status as ScanStatus);
  const scannedDate = new Date(scan.scannedAt).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const impactContent =
    activeTab === "short"
      ? [
          { label: "Energy Response", value: scan.shortTermImpact.energyResponse },
          { label: "Blood Sugar", value: scan.shortTermImpact.bloodSugarResponse },
          { label: "Body Reaction", value: scan.shortTermImpact.bodyReaction },
          { label: "Hydration Impact", value: scan.shortTermImpact.hydrationImpact },
        ]
      : activeTab === "medium"
      ? [
          { label: "Energy Stability", value: scan.mediumTermImpact.energyStability },
          { label: "Physical Changes", value: scan.mediumTermImpact.physicalChanges },
          { label: "Habit Risk", value: scan.mediumTermImpact.habitRisk },
          { label: "Sleep Quality", value: scan.mediumTermImpact.sleepQuality },
        ]
      : [
          { label: "Health Trend", value: scan.longTermImpact.healthTrend },
          { label: "Metabolic Impact", value: scan.longTermImpact.metabolicImpact },
          { label: "Risk Accumulation", value: scan.longTermImpact.riskAccumulation },
          { label: "Nutritional Balance", value: scan.longTermImpact.nutritionalBalance },
        ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Close button */}
      <View
        style={{
          position: "absolute",
          top: insets.top + 12,
          right: 20,
          zIndex: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
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
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
          gap: 20,
        }}
      >
        {/* Header: score + product info */}
        <GlassCard style={{ borderColor: `${sColor}30` }}>
          <View style={{ alignItems: "center", gap: 16, paddingVertical: 8 }}>
            <ScoreRing score={scan.impactScore} size={160} strokeWidth={14} />
            <View style={{ alignItems: "center", gap: 6 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 22,
                  fontWeight: "800",
                  fontFamily: "Inter_700Bold",
                  textAlign: "center",
                }}
              >
                {scan.detectedProduct}
              </Text>
              {scan.brand && (
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                  {scan.brand}
                </Text>
              )}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 10,
                    backgroundColor: `${sColor}18`,
                    borderWidth: 1,
                    borderColor: `${sColor}30`,
                  }}
                >
                  <Text style={{ color: sColor, fontSize: 13, fontWeight: "700" }}>
                    {statusLabel(scan.status as ScanStatus)}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 10,
                    backgroundColor: colors.backgroundTertiary,
                  }}
                >
                  <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>
                    {scan.category}
                  </Text>
                </View>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4 }}>
                {scannedDate}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Quick stats row */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { icon: "flame", label: "Calories", value: `${scan.composition.calories}`, color: colors.scoreMedium },
            { icon: "nutrition", label: "Sugar", value: `${scan.composition.sugarGrams}g`, color: colors.scoreLow },
            { icon: "water", label: "Hydration", value: `${scan.hydrationLevel}%`, color: colors.primary },
            { icon: "flash", label: "Caffeine", value: `${scan.composition.caffeineMg}mg`, color: colors.secondary },
          ].map((item) => (
            <View
              key={item.label}
              style={{
                flex: 1,
                backgroundColor: colors.backgroundSecondary,
                borderRadius: 14,
                padding: 10,
                alignItems: "center",
                gap: 4,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name={item.icon as any} size={14} color={item.color} />
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "800" }}>
                {item.value}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* AI Insight */}
        <GlassCard>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" }}>
                AI Insight
              </Text>
            </View>
            <Text style={{ color: colors.subtext, fontSize: 14, lineHeight: 21 }}>
              {scan.aiInsight}
            </Text>
            {scan.viralStatement && (
              <LinearGradient
                colors={["rgba(0,180,216,0.1)", "rgba(123,44,191,0.1)"]}
                style={{
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: `${colors.primary}20`,
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontStyle: "italic", textAlign: "center" }}>
                  "{scan.viralStatement}"
                </Text>
              </LinearGradient>
            )}
          </View>
        </GlassCard>

        {/* Impact Tabs */}
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.backgroundSecondary,
              borderRadius: 14,
              padding: 4,
            }}
          >
            {TAB_LABELS.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  alignItems: "center",
                  borderRadius: 10,
                  backgroundColor:
                    activeTab === t.key ? colors.primaryDim : "transparent",
                  borderWidth: activeTab === t.key ? 1 : 0,
                  borderColor: activeTab === t.key ? `${colors.primary}40` : "transparent",
                }}
              >
                <Text
                  style={{
                    color: activeTab === t.key ? colors.primary : colors.mutedForeground,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <GlassCard padding={12}>
            {impactContent.map((item, i) => (
              <ImpactRow
                key={item.label}
                label={item.label}
                value={item.value}
                color={
                  activeTab === "short"
                    ? colors.primary
                    : activeTab === "medium"
                    ? colors.secondary
                    : colors.accent
                }
              />
            ))}
          </GlassCard>
        </View>

        {/* Composition */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "800", fontFamily: "Inter_700Bold" }}>
            Composition
          </Text>

          {/* Glycemic impact */}
          <GlassCard>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: colors.subtext, fontSize: 14 }}>Glycemic Impact</Text>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor:
                    scan.glycemicImpact === "low"
                      ? colors.scoreHighDim
                      : scan.glycemicImpact === "moderate"
                      ? `${colors.scoreMedium}18`
                      : colors.scoreLowDim,
                }}
              >
                <Text
                  style={{
                    color:
                      scan.glycemicImpact === "low"
                        ? colors.scoreHigh
                        : scan.glycemicImpact === "moderate"
                        ? colors.scoreMedium
                        : colors.scoreLow,
                    fontSize: 12,
                    fontWeight: "700",
                    textTransform: "capitalize",
                  }}
                >
                  {scan.glycemicImpact.replace("_", " ")}
                </Text>
              </View>
            </View>
          </GlassCard>

          {/* Ingredients */}
          <GlassCard>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 12 }}>
              Key Ingredients
            </Text>
            {scan.composition.ingredients.slice(0, 8).map((ing, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 8,
                  borderBottomWidth: i < scan.composition.ingredients.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor:
                      ing.healthRole === "positive"
                        ? colors.scoreHigh
                        : ing.healthRole === "neutral"
                        ? colors.primary
                        : colors.scoreLow,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
                    {ing.name}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 1 }}>
                    {ing.function}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    backgroundColor:
                      ing.riskLevel === "low"
                        ? colors.scoreHighDim
                        : ing.riskLevel === "medium"
                        ? `${colors.scoreMedium}18`
                        : colors.scoreLowDim,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color:
                        ing.riskLevel === "low"
                          ? colors.scoreHigh
                          : ing.riskLevel === "medium"
                          ? colors.scoreMedium
                          : colors.scoreLow,
                      textTransform: "capitalize",
                    }}
                  >
                    {ing.riskLevel}
                  </Text>
                </View>
              </View>
            ))}
          </GlassCard>

          {/* Additives */}
          {scan.composition.additives.length > 0 && (
            <GlassCard>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 10 }}>
                Additives
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {scan.composition.additives.map((a, i) => (
                  <View
                    key={i}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: colors.backgroundTertiary,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.subtext, fontSize: 12 }}>{a}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
