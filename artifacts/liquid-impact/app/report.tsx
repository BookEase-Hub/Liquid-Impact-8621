import React, { useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { ScoreRing, GlassCard, statusColor, statusLabel, BodyRing } from "@/components/ui";
import { MedicalDisclaimer, AIEstimateNotice, DisclaimerBadge } from "@/components/disclaimer";
import type { ScanStatus } from "@/types";

type ImpactTab = "short" | "medium" | "long";

const TAB_LABELS: { key: ImpactTab; label: string; color: string }[] = [
  { key: "short", label: "1-2 Hours", color: "#00B4D8" },
  { key: "medium", label: "Weeks", color: "#7B2CBF" },
  { key: "long", label: "Months+", color: "#FF6B9D" },
];

function ImpactRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={{ gap: 4, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 }}>
        {label}
      </Text>
      <Text style={{ color: colors.subtext, fontSize: 14, lineHeight: 20 }}>{value}</Text>
    </View>
  );
}

function NutritionBar({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const colors = useColors();
  const pct = Math.min(100, (value / max) * 100);
  return (
    <View style={{ gap: 6, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.subtext, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>{value}{unit}</Text>
      </View>
      <View style={{ height: 5, backgroundColor: colors.backgroundTertiary, borderRadius: 3, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 3 }} />
      </View>
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
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", gap: 12 }}>
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
    weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const impactContent =
    activeTab === "short"
      ? [
          { label: "Energy Response Estimate (1-2h)", value: scan.shortTermImpact.energyResponse },
          { label: "Blood Sugar Indicator", value: scan.shortTermImpact.bloodSugarResponse },
          { label: "Body Response Indicator", value: scan.shortTermImpact.bodyReaction },
          { label: "Hydration Impact Estimate", value: scan.shortTermImpact.hydrationImpact },
        ]
      : activeTab === "medium"
      ? [
          { label: "Energy Stability Estimate (weeks)", value: scan.mediumTermImpact.energyStability },
          { label: "Potential Physical Indicators", value: scan.mediumTermImpact.physicalChanges },
          { label: "Habit Formation Consideration", value: scan.mediumTermImpact.habitRisk },
          { label: "Sleep Quality Consideration", value: scan.mediumTermImpact.sleepQuality },
        ]
      : [
          { label: "General Wellness Trend", value: scan.longTermImpact.healthTrend },
          { label: "Metabolic Consideration", value: scan.longTermImpact.metabolicImpact },
          { label: "Long-Term Wellness Factor", value: scan.longTermImpact.riskAccumulation },
          { label: "Nutritional Balance Indicator", value: scan.longTermImpact.nutritionalBalance },
        ];

  const tabColor = TAB_LABELS.find((t) => t.key === activeTab)?.color ?? colors.primary;

  const isNonBeverage = scan.liquidType && !["beverage", "alcohol", "supplement"].includes(scan.liquidType);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
  {/* Header Actions */}
  <View style={{ position: "absolute", top: insets.top + 12, left: 20, right: 20, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
        <TouchableOpacity
          onPress={() => router.back()}
      style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}
    >
      <Ionicons name="arrow-back" size={20} color="#fff" />
    </TouchableOpacity>

    <TouchableOpacity
      onPress={async () => {
        try {
          await Share.share({
            message: `🥤 I just scanned ${scan.detectedProduct} with Liquid Impact! Wellness Score: ${scan.impactScore}/100. ${scan.viralStatement ?? ''}`,
          });
        } catch (error) {
          console.log(error);
        }
      }}
      style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}
        >
      <Ionicons name="share-social" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
          gap: 18,
        }}
      >
        {/* Header */}
        <GlassCard style={{ borderColor: `${sColor}30` }}>
          <View style={{ alignItems: "center", gap: 16, paddingVertical: 8 }}>
            <ScoreRing score={scan.impactScore} size={160} strokeWidth={14} />
            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "800", fontFamily: "Inter_700Bold", textAlign: "center" }}>
                {scan.detectedProduct}
              </Text>
              {scan.brand && <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{scan.brand}</Text>}
              <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
                <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, backgroundColor: `${sColor}18`, borderWidth: 1, borderColor: `${sColor}30` }}>
                  <Text style={{ color: sColor, fontSize: 13, fontWeight: "700" }}>{statusLabel(scan.status as ScanStatus)}</Text>
                </View>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.backgroundTertiary }}>
                  <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>
                    {scan.category.replace(/_/g, " ")}
                  </Text>
                </View>
                {isNonBeverage && (
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "#FF980014", borderWidth: 1, borderColor: "#FF980030" }}>
                    <Text style={{ color: "#FF9800", fontSize: 11, fontWeight: "700" }}>Non-beverage</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4 }}>{scannedDate}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Medical disclaimer — prominent, near top */}
        <MedicalDisclaimer />

        {/* Non-beverage notice */}
        {isNonBeverage && (
          <View style={{ flexDirection: "row", gap: 10, padding: 14, borderRadius: 16, backgroundColor: "#FF980014", borderWidth: 1, borderColor: "#FF980030" }}>
            <Ionicons name="warning" size={18} color="#FF9800" />
            <Text style={{ flex: 1, color: "#FF9800", fontSize: 13, fontWeight: "600", lineHeight: 18 }}>
              {scan.liquidType === "cooking_oil"
                ? "This is a cooking oil — not designed for direct consumption as a drink. Analysis reflects its nutritional profile, not drinking suitability."
                : "This is a condiment used in small amounts — scores reflect its impact profile, not typical beverage consumption."}
            </Text>
          </View>
        )}

        {/* Quick stats — 6 metrics */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            { icon: "flame", label: "Calories", value: `${scan.composition.calories}`, color: colors.scoreMedium },
            { icon: "nutrition", label: "Sugar", value: `${scan.composition.sugarGrams}g`, color: colors.scoreLow },
            { icon: "water", label: "Hydration", value: `${scan.hydrationLevel}%`, color: colors.primary },
            { icon: "flash", label: "Caffeine", value: `${scan.composition.caffeineMg}mg`, color: colors.secondary },
            { icon: "cellular", label: "Sodium", value: `${scan.composition.sodiumMg}mg`, color: colors.scoreMedium },
            { icon: "ellipse", label: "Fat", value: `${scan.composition.fatGrams}g`, color: "#FF6B9D" },
          ].map((item) => (
            <View key={item.label} style={{ width: "30%", backgroundColor: colors.backgroundSecondary, borderRadius: 14, padding: 10, alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name={item.icon as any} size={14} color={item.color} />
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "800" }}>{item.value}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Body metrics */}
        <GlassCard>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 16 }}>
            Body Impact Indicators
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <BodyRing value={scan.hydrationLevel} label="Hydration" icon="water" color={colors.primary} />
            <BodyRing value={scan.impactScore} label="Impact" icon="sparkles" color={colors.secondary} />
            <BodyRing
              value={scan.glycemicImpact === "low" ? 20 : scan.glycemicImpact === "moderate" ? 50 : scan.glycemicImpact === "high" ? 80 : 95}
              label="Glycemic"
              icon="flash"
              color={scan.glycemicImpact === "low" ? colors.scoreHigh : scan.glycemicImpact === "moderate" ? colors.scoreMedium : colors.scoreLow}
            />
            <BodyRing
              value={scan.dehydrationRisk ? 75 : 15}
              label="Dehyd Risk"
              icon="warning"
              color={scan.dehydrationRisk ? colors.danger : colors.scoreHigh}
            />
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 10, textAlign: "center", marginTop: 12, fontStyle: "italic" }}>
            Indicators are estimates based on image analysis, not clinical measurements.
          </Text>
        </GlassCard>

        {/* AI Insight */}
        <GlassCard>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" }}>AI Wellness Insight</Text>
              <View style={{ marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.06)" }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 9, fontWeight: "700" }}>ESTIMATE</Text>
              </View>
            </View>
            <Text style={{ color: colors.subtext, fontSize: 14, lineHeight: 21 }}>{scan.aiInsight}</Text>
            {scan.viralStatement && (
              <LinearGradient
                colors={["rgba(0,180,216,0.1)", "rgba(123,44,191,0.1)"]}
                style={{ borderRadius: 12, padding: 12, borderWidth: 1, borderColor: `${colors.primary}20` }}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontStyle: "italic", textAlign: "center" }}>
                  "{scan.viralStatement}"
                </Text>
              </LinearGradient>
            )}
            <AIEstimateNotice />
          </View>
        </GlassCard>

        {/* Alternatives */}
        {scan.alternatives && scan.alternatives.length > 0 && (
          <GlassCard style={{ borderColor: `${colors.scoreHigh}20` }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Ionicons name="leaf" size={16} color={colors.scoreHigh} />
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" }}>Healthier Alternatives</Text>
            </View>
            {scan.alternatives.map((alt, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 }}>
                <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: colors.successDim, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: colors.success, fontSize: 12, fontWeight: "700" }}>{i + 1}</Text>
                </View>
                <Text style={{ color: colors.subtext, fontSize: 14 }}>{alt}</Text>
              </View>
            ))}
          </GlassCard>
        )}

        {/* Impact Tabs */}
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", backgroundColor: colors.backgroundSecondary, borderRadius: 14, padding: 4 }}>
            {TAB_LABELS.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                activeOpacity={0.8}
                style={{
                  flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 10,
                  backgroundColor: activeTab === t.key ? `${t.color}18` : "transparent",
                  borderWidth: activeTab === t.key ? 1 : 0,
                  borderColor: activeTab === t.key ? `${t.color}40` : "transparent",
                }}
              >
                <Text style={{ color: activeTab === t.key ? t.color : colors.mutedForeground, fontSize: 12, fontWeight: "700" }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <GlassCard padding={12} style={{ borderColor: `${tabColor}20` }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tabColor }} />
              <Text style={{ color: tabColor, fontSize: 12, fontWeight: "700" }}>
                {activeTab === "short"
                  ? "Estimated Short-Term Effects (1-2 Hours)"
                  : activeTab === "medium"
                  ? "Estimated Medium-Term Effects (Weeks)"
                  : "Potential Long-term Considerations (Months+)"}
              </Text>
            </View>
            {impactContent.map((item) => (
              <ImpactRow key={item.label} label={item.label} value={item.value} />
            ))}
            {activeTab === "long" && (
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontStyle: "italic", marginTop: 8, lineHeight: 16 }}>
                Long-term projections are general wellness considerations, not medical predictions. Individual results vary significantly.
              </Text>
            )}
          </GlassCard>
        </View>

        {/* Nutrition detail */}
        <GlassCard>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 16 }}>
            Nutrition Breakdown
          </Text>
          <NutritionBar label="Calories" value={scan.composition.calories} max={500} unit=" kcal" color={colors.scoreMedium} />
          <NutritionBar label="Sugar" value={scan.composition.sugarGrams} max={50} unit="g" color={colors.scoreLow} />
          <NutritionBar label="Fat" value={scan.composition.fatGrams} max={30} unit="g" color="#FF6B9D" />
          <NutritionBar label="Protein" value={scan.composition.proteinGrams} max={30} unit="g" color={colors.scoreHigh} />
          <NutritionBar label="Sodium" value={scan.composition.sodiumMg} max={2300} unit="mg" color={colors.scoreMedium} />
          <NutritionBar label="Caffeine" value={scan.composition.caffeineMg} max={400} unit="mg" color={colors.secondary} />

          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              Serving: {scan.composition.servingSize}{scan.composition.servingUnit}
            </Text>
            {scan.composition.artificialSweeteners && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.scoreLowDim }}>
                <Text style={{ color: colors.scoreLow, fontSize: 10, fontWeight: "700" }}>Artificial Sweeteners</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 10, fontStyle: "italic", marginTop: 8 }}>
            Values are AI estimates based on image analysis. For precise nutrition, check product labelling.
          </Text>
        </GlassCard>

        {/* Additional Info */}
        <GlassCard>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" }}>Additional Info</Text>
          </View>
          {[
            {
              label: "Glycemic Impact Indicator",
              value: scan.glycemicImpact.replace("_", " "),
              color: scan.glycemicImpact === "low" ? colors.scoreHigh : scan.glycemicImpact === "moderate" ? colors.scoreMedium : colors.scoreLow,
            },
            {
              label: "Dehydration Risk Indicator",
              value: scan.dehydrationRisk ? "Significant" : "Low",
              color: scan.dehydrationRisk ? colors.danger : colors.scoreHigh,
            },
            {
              label: "AI Confidence Score",
              value: `${Math.round((scan.confidenceScore ?? 0.85) * 100)}%`,
              color: colors.primary,
            },
          ].map((row) => (
            <View key={row.label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.subtext, fontSize: 13 }}>{row.label}</Text>
              <Text style={{ color: row.color, fontSize: 13, fontWeight: "700", textTransform: "capitalize" }}>{row.value}</Text>
            </View>
          ))}
        </GlassCard>

        {/* Ingredients */}
        {scan.composition.ingredients.length > 0 && (
          <GlassCard>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 12 }}>
              Key Ingredients ({scan.composition.ingredients.length})
            </Text>
            {scan.composition.ingredients.slice(0, 8).map((ing, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 9, borderBottomWidth: i < Math.min(8, scan.composition.ingredients.length) - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: ing.healthRole === "positive" ? colors.scoreHigh : ing.healthRole === "neutral" ? colors.primary : colors.scoreLow }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>{ing.name}</Text>
                  {ing.function && <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 1 }}>{ing.function}</Text>}
                  {ing.aiNote && <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 2, fontStyle: "italic" }}>{ing.aiNote}</Text>}
                </View>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
                  backgroundColor: ing.riskLevel === "low" ? colors.scoreHighDim : ing.riskLevel === "medium" ? `${colors.scoreMedium}18` : colors.scoreLowDim,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: ing.riskLevel === "low" ? colors.scoreHigh : ing.riskLevel === "medium" ? colors.scoreMedium : colors.scoreLow, textTransform: "capitalize" }}>
                    {ing.riskLevel}
                  </Text>
                </View>
              </View>
            ))}
          </GlassCard>
        )}

        {/* Additives */}
        {scan.composition.additives.length > 0 && (
          <GlassCard>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 10 }}>
              Additives ({scan.composition.additives.length})
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {scan.composition.additives.map((a, i) => (
                <View key={i} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.backgroundTertiary, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.subtext, fontSize: 12 }}>{a}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        )}

        {/* Bottom disclaimer */}
        <DisclaimerBadge />
        <MedicalDisclaimer compact />
      </ScrollView>
    </View>
  );
}
