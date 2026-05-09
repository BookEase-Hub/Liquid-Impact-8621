import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { GlassCard, ScoreRing, statusColor, statusLabel, GradientButton } from "@/components/ui";
import { analyzeDrink } from "@/services/api";
import type { ScanResult } from "@/types";

type ScanState = "idle" | "analyzing" | "result" | "error";

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addScan, canScan, todayScanCount, state } = useApp();

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

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
        "Daily limit reached",
        `Free plan allows 5 scans/day. Upgrade to Pro for unlimited scans.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Upgrade", onPress: () => router.push("/paywall") },
        ]
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
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to analyze drink"
      );
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
        <View>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>AI-powered</Text>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 26,
              fontWeight: "800",
              fontFamily: "Inter_700Bold",
              marginTop: 2,
            }}
          >
            Scan a Drink
          </Text>
          {state.subscription === "free" && (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
              {todayScanCount}/5 free scans today
            </Text>
          )}
        </View>

        {/* Image area */}
        {selectedImage ? (
          <View style={{ borderRadius: 24, overflow: "hidden", position: "relative" }}>
            <Image
              source={{ uri: selectedImage }}
              style={{ width: "100%", height: 240 }}
              resizeMode="cover"
            />
            {scanState !== "analyzing" && scanState !== "result" && (
              <TouchableOpacity
                onPress={reset}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View
            style={{
              height: 240,
              borderRadius: 24,
              borderWidth: 2,
              borderColor: colors.border,
              borderStyle: "dashed",
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
              backgroundColor: colors.backgroundSecondary,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: colors.primaryDim,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="camera" size={30} color={colors.primary} />
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 15, fontWeight: "600" }}>
              Take or select a photo
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 12,
                textAlign: "center",
                paddingHorizontal: 32,
              }}
            >
              Point at any drink — bottle, glass, can — and let AI analyze it
            </Text>
          </View>
        )}

        {/* Pick buttons (when no image selected) */}
        {!selectedImage && (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => pickImage(true)}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: colors.backgroundSecondary,
                borderRadius: 20,
                paddingVertical: 16,
                alignItems: "center",
                gap: 8,
                borderWidth: 1,
                borderColor: `${colors.primary}30`,
              }}
            >
              <Ionicons name="camera" size={24} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>
                Camera
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => pickImage(false)}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: colors.backgroundSecondary,
                borderRadius: 20,
                paddingVertical: 16,
                alignItems: "center",
                gap: 8,
                borderWidth: 1,
                borderColor: `${colors.secondary}30`,
              }}
            >
              <Ionicons name="images" size={24} color={colors.secondary} />
              <Text style={{ color: colors.secondary, fontSize: 14, fontWeight: "700" }}>
                Gallery
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Retake / Pick buttons (when image selected) */}
        {selectedImage && scanState !== "analyzing" && scanState !== "result" && (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => pickImage(true)}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: colors.backgroundSecondary,
                borderRadius: 16,
                paddingVertical: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.subtext, fontSize: 14, fontWeight: "600" }}>
                Retake
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => pickImage(false)}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: colors.backgroundSecondary,
                borderRadius: 16,
                paddingVertical: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.subtext, fontSize: 14, fontWeight: "600" }}>
                Gallery
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Analyze button */}
        {selectedImage && scanState !== "analyzing" && scanState !== "result" && (
          <TouchableOpacity
            onPress={analyze}
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
                flexDirection: "row",
                gap: 10,
              }}
            >
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text
                style={{
                  color: "#fff",
                  fontSize: 17,
                  fontWeight: "800",
                  fontFamily: "Inter_700Bold",
                }}
              >
                Analyze with AI
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Analyzing state */}
        {scanState === "analyzing" && (
          <GlassCard>
            <View style={{ alignItems: "center", paddingVertical: 24, gap: 16 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 17,
                  fontWeight: "700",
                  fontFamily: "Inter_700Bold",
                }}
              >
                Analyzing your drink...
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center" }}>
                AI is scanning ingredients, checking glycemic impact, and calculating your health score
              </Text>
            </View>
          </GlassCard>
        )}

        {/* Error state */}
        {scanState === "error" && (
          <GlassCard style={{ borderColor: `${colors.danger}30` }}>
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 8 }}>
              <Ionicons name="alert-circle" size={40} color={colors.danger} />
              <Text style={{ color: colors.danger, fontSize: 16, fontWeight: "700" }}>
                Analysis Failed
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center" }}>
                {errorMsg || "Could not analyze this image. Try again."}
              </Text>
              <TouchableOpacity
                onPress={analyze}
                style={{
                  paddingHorizontal: 24,
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: `${colors.danger}18`,
                  borderWidth: 1,
                  borderColor: `${colors.danger}30`,
                }}
              >
                <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "700" }}>
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Result preview */}
        {scanState === "result" && result && (
          <>
            <GlassCard style={{ borderColor: `${statusColor(result.status)}30` }}>
              <View style={{ alignItems: "center", gap: 16 }}>
                <ScoreRing score={result.impactScore} size={140} />
                <View style={{ alignItems: "center", gap: 4 }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 20,
                      fontWeight: "800",
                      fontFamily: "Inter_700Bold",
                    }}
                  >
                    {result.detectedProduct}
                  </Text>
                  {result.brand && (
                    <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                      {result.brand}
                    </Text>
                  )}
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 10,
                      backgroundColor: `${statusColor(result.status)}18`,
                      marginTop: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: statusColor(result.status),
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      {statusLabel(result.status)}
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    color: colors.subtext,
                    fontSize: 14,
                    textAlign: "center",
                    lineHeight: 20,
                  }}
                >
                  {result.aiInsight}
                </Text>
              </View>
            </GlassCard>

            {/* Quick stats */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[
                { label: "Calories", value: `${result.composition.calories}`, icon: "flame", color: colors.scoreMedium },
                { label: "Sugar", value: `${result.composition.sugarGrams}g`, icon: "nutrition", color: colors.scoreLow },
                { label: "Hydration", value: `${result.hydrationLevel}%`, icon: "water", color: colors.primary },
              ].map((item) => (
                <View
                  key={item.label}
                  style={{
                    flex: 1,
                    backgroundColor: colors.backgroundSecondary,
                    borderRadius: 16,
                    padding: 12,
                    alignItems: "center",
                    gap: 4,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name={item.icon as any} size={16} color={item.color} />
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>
                    {item.value}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Actions */}
            <TouchableOpacity
              onPress={() => router.push(`/report?id=${result.id}`)}
              activeOpacity={0.85}
              style={{ borderRadius: 20, overflow: "hidden" }}
            >
              <LinearGradient
                colors={["#00B4D8", "#7B2CBF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 16,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                  View Full Report
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={reset} activeOpacity={0.7} style={{ alignItems: "center" }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 14, fontWeight: "600" }}>
                Scan Another Drink
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}
