import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

function Section({ title, children }: { title: string; children: string }) {
  const C = useColors();
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: C.foreground, fontSize: 16, fontWeight: "700", marginBottom: 8 }}>
        {title}
      </Text>
      <Text style={{ color: C.mutedForeground, fontSize: 14, lineHeight: 22 }}>
        {children}
      </Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
        <Text style={{ color: C.foreground, fontSize: 22, fontWeight: "800" }}>
          Privacy Policy
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <Text style={{ color: C.mutedForeground, fontSize: 12, marginBottom: 24 }}>
          Last updated: May 2026
        </Text>

        <Section title="1. Information We Collect">
          We collect information you provide directly: email address, display name, and profile photo. We also collect scan data (beverage images and analysis results) and usage analytics to improve the App. We do not sell your personal data to third parties.
        </Section>

        <Section title="2. How We Use Your Information">
          We use your information to: provide and improve the App, personalize your experience, process payments, send important account notifications, and analyze usage patterns to enhance features. Drink images you upload are processed by our AI and are not stored permanently on our servers.
        </Section>

        <Section title="3. Data Storage and Security">
          Your scan history is stored locally on your device using secure storage. Account data is stored on encrypted servers. We use industry-standard security measures including TLS encryption for data in transit and AES-256 encryption for data at rest.
        </Section>

        <Section title="4. Third-Party Services">
          We use the following third-party services: OpenAI (GPT-4o) for drink analysis, RevenueCat for subscription management, and Google/Apple for OAuth sign-in. Each of these services has their own privacy policy governing their use of your data.
        </Section>

        <Section title="5. Your Rights">
          You have the right to: access your personal data, request correction of inaccurate data, request deletion of your account and data, and opt out of analytics. To exercise these rights, contact us at privacy@liquidimpact.app.
        </Section>

        <Section title="6. Data Retention">
          We retain your account data for as long as your account is active. When you delete your account, we will remove your personal data within 30 days, except where retention is required by law.
        </Section>

        <Section title="7. Children's Privacy">
          Liquid Impact is not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13.
        </Section>

        <Section title="8. Cookies and Analytics">
          On the web version of our App, we may use cookies and similar technologies for analytics. You can control cookie settings through your browser preferences. Mobile apps do not use cookies but may use device identifiers for analytics purposes.
        </Section>

        <Section title="9. International Transfers">
          Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for any international transfers of personal data.
        </Section>

        <Section title="10. Contact Us">
          For privacy-related questions or requests, contact our Data Protection team at: privacy@liquidimpact.app or write to: Liquid Impact Privacy Team, support@liquidimpact.app
        </Section>
      </ScrollView>
    </View>
  );
}
