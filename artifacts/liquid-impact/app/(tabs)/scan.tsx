import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp, SUBSCRIPTION_LIMITS } from "@/context/AppContext";
import { GlassCard, ScoreRing, statusColor, statusLabel } from "@/components/ui";
import { analyzeDrink } from "@/services/api";
import type { ScanResult } from "@/types";

type ScanState = "idle" | "analyzing" | "result" | "error";

const LIQUID_TYPE_WARNING: Record<string, { message: string; icon: string; color: string }> = {
  cooking_oil: {
    message: "This is a cooking oil — not meant for direct consumption as a drink.",
    icon: "warning",
    color: "#FF9800",
  },
  condiment: {
    message: "This appears to be a condiment used in small amounts, not as a beverage.",
    icon: "information-circle",
    color: "#FF9800",
  },
  other: {
    message: "This doesn't appear to be a typical beverage.",
    icon: "alert-circle",
    color: "#FF3D00",
  },
};

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addScan, canScan, scanLimitMessage, todayScanCount, monthScanCount, state } = useApp();

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const limits = SUBSCRIPTION_LIMITS[state.subscription];

  const limitText = (() => {
    if (state.subscription === "free") return `${todayScanCount}/${limits.daily} free scans today`;
    if (state.subscription === "starter") return `${monthScanCount}/${limits.monthly} scans this month`;
    return "Unlimited scans";
  })();

  const pickImage = async (useCamera: boolean) => {
    try {
      let pickerResult: ImagePicker.ImagePickerResult;

      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission required", "Camera access is needed to scan drinks.");
          return;
        }
        pickerResult = await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          quality: 0.8,
          base64: true,
          allowsEditing: true,
          aspect: [4, 3],
        });
      } else {
        pickerResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          quality: 0.8,
          base64: true,
          allowsEditing: true,
          aspect: [4, 3],
        });
      }

      if (!pickerResult.canceled && pickerResult.assets[0]) {
        const asset = pickerResult.assets[0];
        setSelectedImage(asset.uri);
        setImageBase64(asset.base64 ?? null);
        setResult(null);
        setScanState("idle");
        await Haptics.selectionAsync();
      }
    } catch {
      Alert.alert("Error", "Could not open camera or gallery.");
    }
  };

  const analyze = async () => {
    if (!imageBase64) return;
    if (!canScan) {
      Alert.alert(
        "Scan limit reached",
        scanLimitMessage || "You've used all your scans. Upgrade to get more.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Upgrade", onPress: () => router.push("/paywall") },
        ],
      );
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setScanState("analyzing");
    setErrorMsg("");

    try {
      const scanResult = await analyzeDrink(imageBase64);
      addScan(scanResult);
      setResult(scanResult);
      setScanState("result");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setScanState("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to analyze drink");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const reset = () => {
    setSelectedImage(null);
    setImageBase64(null);
    setResult(null);
    setScanState("idle");
    setErrorMsg("");
  };

  const liquidWarning = result?.liquidType ? LIQUID_TYPE_WARNING[result.liquidType] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 20,
          gap: 20,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>AI-powered</Text>
            <Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "800", fontFamily: "Inter_700Bold", marginTop: 2 }}>
              Scan a Drink
            </Text>
            <Text style={{ color: canScan ? colors.mutedForeground : colors.scoreMedium, fontSize: 12, marginTop: 4 }}>
              {limitText}
            </Text>
          </View>
          {!canScan && (
            <TouchableOpacity
              onPress={() => router.push("/paywall")}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: `${colors.primary}30` }}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>Upgrade</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Image area */}
        {selectedImage ? (
          <View style={{ borderRadius: 24, overflow: "hidden", position: "relative" }}>
            <Image source={{ uri: selectedImage }} style={{ width: "100%", height: 260 }} resizeMode="cover" />
            {scanState !== "analyzing" && scanState !== "result" && (
              <TouchableOpacity
                onPress={reset}
                style={{ position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" }}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            )}
            {scanState === "analyzing" && (
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", gap: 14 }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Analyzing...</Text>
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => pickImage(false)}
            activeOpacity={0.8}
            style={{ height: 260, borderRadius: 24, borderWidth: 2, borderColor: colors.border, borderStyle: "dashed", justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: colors.backgroundSecondary }}
          >
            <LinearGradient colors={["#00B4D8", "#7B2CBF"]} style={{ width: 72, height: 72, borderRadius: 22, justifyContent: "center", alignItems: "center" }}>
              <Ionicons name="camera" size={32} color="#fff" />
            </LinearGradient>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>Take or select a photo</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center", paddingHorizontal: 32, lineHeight: 18 }}>
              Point at any drink — bottle, glass, can — and let AI analyze it
            </Text>
          </TouchableOpacity>
        )}

        {/* Pick buttons (no image) */}
        {!selectedImage && (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => pickImage(true)}
              activeOpacity={0.8}
              style={{ flex: 1, backgroundColor: colors.backgroundSecondary, borderRadius: 20, paddingVertical: 16, alignItems: "center", gap: 8, borderWidth: 1, borderColor: `${colors.primary}30` }}
            >
              <Ionicons name="camera" size={24} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => pickImage(false)}
              activeOpacity={0.8}
              style={{ flex: 1, backgroundColor: colors.backgroundSecondary, borderRadius: 20, paddingVertical: 16, alignItems: "center", gap: 8, borderWidth: 1, borderColor: `${colors.secondary}30` }}
            >
              <Ionicons name="images" size={24} color={colors.secondary} />
              <Text style={{ color: colors.secondary, fontSize: 14, fontWeight: "700" }}>Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Retake / Pick (image selected) */}
        {selectedImage && scanState !== "analyzing" && scanState !== "result" && (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => pickImage(true)}
              activeOpacity={0.8}
              style={{ flex: 1, backgroundColor: colors.backgroundSecondary, borderRadius: 16, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.subtext, fontSize: 14, fontWeight: "600" }}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => pickImage(false)}
              activeOpacity={0.8}
              style={{ flex: 1, backgroundColor: colors.backgroundSecondary, borderRadius: 16, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.subtext, fontSize: 14, fontWeight: "600" }}>Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Analyze button */}
        {selectedImage && scanState !== "analyzing" && scanState !== "result" && (
          <TouchableOpacity onPress={analyze} activeOpacity={0.85} style={{ borderRadius: 24, overflow: "hidden" }}>
            <LinearGradient
              colors={["#00B4D8", "#7B2CBF"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }}
            >
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800", fontFamily: "Inter_700Bold" }}>Analyze with AI</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Analyzing state */}
        {scanState === "analyzing" && (
          <GlassCard>
            <View style={{ alignItems: "center", paddingVertical: 20, gap: 14 }}>
              <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold" }}>
                Analyzing your drink...
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
                GPT-4o is scanning ingredients, checking glycemic impact, and calculating your health score
              </Text>
            </View>
          </GlassCard>
        )}

        {/* Error state */}
        {scanState === "error" && (
          <GlassCard style={{ borderColor: `${colors.danger}30` }}>
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 8 }}>
              <Ionicons name="alert-circle" size={40} color={colors.danger} />
              <Text style={{ color: colors.danger, fontSize: 16, fontWeight: "700" }}>Analysis Failed</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center" }}>
                {errorMsg || "Could not analyze this image. Please try again."}
              </Text>
              <TouchableOpacity
                onPress={analyze}
                style={{ paddingHorizontal: 24, paddingVertical: 10, borderRadius: 14, backgroundColor: `${colors.danger}18`, borderWidth: 1, borderColor: `${colors.danger}30` }}
              >
                <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "700" }}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Result */}
        {scanState === "result" && result && (
          <>
            {/* Non-beverage warning */}
            {liquidWarning && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, backgroundColor: `${liquidWarning.color}14`, borderWidth: 1, borderColor: `${liquidWarning.color}30` }}>
                <Ionicons name={liquidWarning.icon as any} size={20} color={liquidWarning.color} />
                <Text style={{ flex: 1, color: liquidWarning.color, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>
                  {liquidWarning.message}
                </Text>
              </View>
            )}

            <GlassCard style={{ borderColor: `${statusColor(result.status)}30` }}>
              <View style={{ alignItems: "center", gap: 16 }}>
                <ScoreRing score={result.impactScore} size={140} />
                <View style={{ alignItems: "center", gap: 4 }}>
                  <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800", fontFamily: "Inter_700Bold", textAlign: "center" }}>
                    {result.detectedProduct}
                  </Text>
                  {result.brand && (
                    <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{result.brand}</Text>
                  )}
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, backgroundColor: `${statusColor(result.status)}18`, borderWidth: 1, borderColor: `${statusColor(result.status)}30` }}>
                      <Text style={{ color: statusColor(result.status), fontSize: 13, fontWeight: "700" }}>
                        {statusLabel(result.status)}
                      </Text>
                    </View>
                    {result.liquidType && result.liquidType !== "beverage" && (
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "#FF980014" }}>
                        <Text style={{ color: "#FF9800", fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>
                          {result.liquidType.replace("_", " ")}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={{ color: colors.subtext, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                  {result.aiInsight}
                </Text>
              </View>
            </GlassCard>

            {/* Quick stats */}
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "Calories", value: `${result.composition.calories}`, icon: "flame", color: colors.scoreMedium },
                { label: "Sugar", value: `${result.composition.sugarGrams}g`, icon: "nutrition", color: colors.scoreLow },
                { label: "Hydration", value: `${result.hydrationLevel}%`, icon: "water", color: colors.primary },
                { label: "Caffeine", value: `${result.composition.caffeineMg}mg`, icon: "flash", color: colors.secondary },
                { label: "Sodium", value: `${result.composition.sodiumMg}mg`, icon: "cellular", color: colors.scoreMedium },
                { label: "Fat", value: `${result.composition.fatGrams}g`, icon: "ellipse", color: "#FF6B9D" },
              ].map((item) => (
                <View key={item.label} style={{ width: "30%", backgroundColor: colors.backgroundSecondary, borderRadius: 14, padding: 10, alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.border }}>
                  <Ionicons name={item.icon as any} size={14} color={item.color} />
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "800" }}>{item.value}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Alternatives */}
            {result.alternatives && result.alternatives.length > 0 && (
              <GlassCard>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700", marginBottom: 10 }}>
                  Healthier Alternatives
                </Text>
                {result.alternatives.map((alt, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.scoreHigh }} />
                    <Text style={{ color: colors.subtext, fontSize: 13 }}>{alt}</Text>
                  </View>
                ))}
              </GlassCard>
            )}

            {/* Actions */}
            <TouchableOpacity onPress={() => router.push(`/report?id=${result.id}`)} activeOpacity={0.85} style={{ borderRadius: 20, overflow: "hidden" }}>
              <LinearGradient colors={["#00B4D8", "#7B2CBF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>View Full Report</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={reset} activeOpacity={0.7} style={{ alignItems: "center" }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, fontWeight: "600" }}>Scan Another Drink</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Needed for the overlay on the image
const StyleSheet = { absoluteFillObject: { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 } };
