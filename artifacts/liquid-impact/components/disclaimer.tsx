import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const MEDICAL_TEXT =
  "Liquid Impact is for informational and general wellness purposes only. It does not provide medical advice, diagnosis, or treatment. Consult a qualified healthcare professional before making any significant dietary or lifestyle changes.";

const AI_ESTIMATE_TEXT =
  "AI-generated estimate based on image analysis and general ingredient data. Results are approximate and for educational purposes only.";

export function MedicalDisclaimer({ compact = false }: { compact?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        padding: compact ? 10 : 14,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        alignItems: "flex-start",
      }}
    >
      <Ionicons
        name="information-circle-outline"
        size={compact ? 14 : 16}
        color={colors.mutedForeground}
        style={{ marginTop: 1 }}
      />
      <Text
        style={{
          flex: 1,
          color: colors.mutedForeground,
          fontSize: compact ? 11 : 12,
          lineHeight: compact ? 16 : 18,
        }}
      >
        {MEDICAL_TEXT}
      </Text>
    </View>
  );
}

export function AIEstimateNotice() {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 6,
        alignItems: "flex-start",
        paddingHorizontal: 2,
        marginTop: 4,
      }}
    >
      <Ionicons name="sparkles-outline" size={11} color={colors.mutedForeground} style={{ marginTop: 1 }} />
      <Text
        style={{
          flex: 1,
          color: colors.mutedForeground,
          fontSize: 11,
          lineHeight: 16,
          fontStyle: "italic",
        }}
      >
        {AI_ESTIMATE_TEXT}
      </Text>
    </View>
  );
}

export function DisclaimerBadge() {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.05)",
        alignSelf: "center",
      }}
    >
      <Ionicons name="shield-checkmark-outline" size={11} color={colors.mutedForeground} />
      <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "600" }}>
        General Wellness Tool · Not Medical Advice
      </Text>
    </View>
  );
}
