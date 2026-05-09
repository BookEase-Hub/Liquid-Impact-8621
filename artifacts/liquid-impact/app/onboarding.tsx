import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  type ViewToken,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    key: "scan",
    headline: "Scan any drink.",
    subtitle:
      "AI analysis of energy, blood sugar, metabolism, and long-term health impact.",
    icon: "camera" as const,
    gradientColors: ["#00B4D8", "#7B2CBF"] as [string, string],
    visual: "camera",
  },
  {
    key: "metrics",
    headline: "Beyond surface-level metrics.",
    subtitle:
      "Deep insights into hydration, glycemic impact, and nutritional quality of every sip.",
    icon: "analytics" as const,
    gradientColors: ["#7B2CBF", "#FF6B9D"] as [string, string],
    visual: "metrics",
  },
  {
    key: "timeline",
    headline: "What happens inside your body.",
    subtitle:
      "Track short-term, medium-term, and long-term health effects from your drinking habits.",
    icon: "time" as const,
    gradientColors: ["#FF6B9D", "#FF9800"] as [string, string],
    visual: "timeline",
  },
  {
    key: "share",
    headline: "Built for everyday life.",
    subtitle:
      "Share insights, get smart alternatives, and track your progress over time.",
    icon: "share-social" as const,
    gradientColors: ["#FF9800", "#00C853"] as [string, string],
    visual: "share",
  },
];

function SlideVisual({ type, gradientColors }: { type: string; gradientColors: [string, string] }) {
  const colors = useColors();

  if (type === "camera") {
    return (
      <View
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderRadius: 24,
          padding: 28,
          alignItems: "center",
          gap: 20,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 28,
            backgroundColor: `${gradientColors[0]}18`,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 2,
            borderColor: `${gradientColors[0]}40`,
          }}
        >
          <Ionicons name="camera" size={48} color={gradientColors[0]} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.backgroundTertiary, overflow: "hidden" }}>
            <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: "78%", height: "100%", borderRadius: 4 }} />
          </View>
          <Text style={{ color: gradientColors[0], fontSize: 13, fontWeight: "800" }}>78</Text>
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center" }}>
          Instant AI health score
        </Text>
      </View>
    );
  }

  if (type === "metrics") {
    return (
      <View
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderRadius: 24,
          padding: 20,
          gap: 12,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {[
          { label: "Impact Score", value: 78, color: gradientColors[0] },
          { label: "Hydration", value: 62, color: gradientColors[1] },
          { label: "Sugar Load", value: 45, color: "#FF9800" },
          { label: "Caffeine", value: 30, color: "#FF6B9D" },
        ].map((m) => (
          <View key={m.label} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.subtext, fontSize: 12 }}>{m.label}</Text>
              <Text style={{ color: m.color, fontSize: 12, fontWeight: "700" }}>{m.value}%</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.backgroundTertiary, overflow: "hidden" }}>
              <View style={{ width: `${m.value}%`, height: "100%", backgroundColor: m.color, borderRadius: 3 }} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (type === "timeline") {
    return (
      <View
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderRadius: 24,
          padding: 20,
          gap: 14,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {[
          { icon: "flash" as const, label: "1 Hour", text: "Energy spike", color: gradientColors[0] },
          { icon: "calendar" as const, label: "30 Days", text: "Habit patterns", color: "#FF9800" },
          { icon: "trending-up" as const, label: "1 Year", text: "Long-term health", color: gradientColors[1] },
        ].map((item) => (
          <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${item.color}18`, justifyContent: "center", alignItems: "center" }}>
              <Ionicons name={item.icon} size={16} color={item.color} />
            </View>
            <View>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>{item.label}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{item.text}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 24,
        padding: 20,
        gap: 14,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {[
        { icon: "share-social" as const, text: "Share with friends", color: gradientColors[0] },
        { icon: "bulb" as const, text: "Smart alternatives", color: gradientColors[1] },
        { icon: "trophy" as const, text: "Track milestones", color: "#FF9800" },
      ].map((item) => (
        <View key={item.text} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${item.color}18`, justifyContent: "center", alignItems: "center" }}>
            <Ionicons name={item.icon} size={16} color={item.color} />
          </View>
          <Text style={{ color: colors.subtext, fontSize: 14 }}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]) {
        setCurrentIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;

  const goNext = async () => {
    await Haptics.selectionAsync();
    if (currentIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      completeOnboarding();
    }
  };

  const skip = () => completeOnboarding();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      {/* Progress dots */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 6,
          paddingTop: 16,
          paddingBottom: 8,
        }}
      >
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={{
              height: 7,
              width: i === currentIndex ? 28 : 7,
              borderRadius: 4,
              backgroundColor:
                i === currentIndex ? colors.primary : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </View>

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: 28, paddingTop: 16, gap: 28 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                backgroundColor: `${item.gradientColors[0]}18`,
                borderWidth: 1,
                borderColor: `${item.gradientColors[0]}30`,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name={item.icon} size={32} color={item.gradientColors[0]} />
            </View>

            <View style={{ gap: 12 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 30,
                  fontWeight: "800",
                  fontFamily: "Inter_700Bold",
                  lineHeight: 36,
                }}
              >
                {item.headline}
              </Text>
              <Text
                style={{
                  color: colors.subtext,
                  fontSize: 16,
                  lineHeight: 24,
                }}
              >
                {item.subtitle}
              </Text>
            </View>

            <SlideVisual type={item.visual} gradientColors={item.gradientColors} />
          </View>
        )}
      />

      {/* Bottom controls */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 16, gap: 12 }}>
        <TouchableOpacity
          onPress={goNext}
          activeOpacity={0.85}
          style={{ borderRadius: 24, overflow: "hidden" }}
        >
          <LinearGradient
            colors={SLIDES[currentIndex].gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 18,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 17,
                fontWeight: "800",
                fontFamily: "Inter_700Bold",
              }}
            >
              {currentIndex === SLIDES.length - 1 ? "Get Started" : "Continue"}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {currentIndex < SLIDES.length - 1 && (
          <TouchableOpacity onPress={skip} activeOpacity={0.7} style={{ alignItems: "center" }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, fontWeight: "600" }}>
              Skip
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
