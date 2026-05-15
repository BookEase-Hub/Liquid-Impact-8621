import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useAuthStore } from "@/features/auth/store";
import { useGoogleAuth } from "@/features/auth/hooks/useGoogleAuth";
import { AuthService } from "@/features/auth/service";
import { signInSchema, signUpSchema, type SignInData, type SignUpData } from "@/features/auth/validation";
import { useColors } from "@/hooks/useColors";

type AuthMode = "signin" | "signup";

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function StyledInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  hasError,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "email-address" | "default";
  autoCapitalize?: "none" | "words";
  autoComplete?: "email" | "password" | "name" | "new-password";
  hasError?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View
      style={[
        styles.inputWrap,
        focused && styles.inputFocused,
        hasError && styles.inputError,
      ]}
    >
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.30)"
        secureTextEntry={isPassword && !showPassword}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "none"}
        autoComplete={autoComplete}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {isPassword && (
        <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
          <Ionicons
            name={showPassword ? "eye-off" : "eye"}
            size={18}
            color="rgba(255,255,255,0.40)"
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const { signIn, loading } = useAuthStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInData>({ resolver: zodResolver(signInSchema) });

  const onSubmit = async (data: SignInData) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await signIn(data.email, data.password);
    onSuccess();
  };

  return (
    <View style={styles.form}>
      <FormField label="Email" error={errors.email?.message}>
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange } }) => (
            <StyledInput
              value={value ?? ""}
              onChangeText={onChange}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              hasError={!!errors.email}
            />
          )}
        />
      </FormField>
      <FormField label="Password" error={errors.password?.message}>
        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange } }) => (
            <StyledInput
              value={value ?? ""}
              onChangeText={onChange}
              placeholder="Your password"
              secureTextEntry
              autoComplete="password"
              hasError={!!errors.password}
            />
          )}
        />
      </FormField>
      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleSubmit(onSubmit)}
        disabled={loading}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={["#00B4D8", "#7B2CBF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.submitGradient}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Sign In</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <ForgotPasswordLink />
    </View>
  );
}

function ForgotPasswordLink() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push("/forgot-password")}
      style={{ alignItems: "center", paddingVertical: 4 }}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="key-outline" size={14} color="rgba(0,180,216,0.80)" />
        <Text style={{ color: "rgba(0,180,216,0.80)", fontSize: 13, fontWeight: "600" }}>
          Forgot Password?
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const { signUp, loading } = useAuthStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpData>({ resolver: zodResolver(signUpSchema) });

  const onSubmit = async (data: SignUpData) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await signUp(data.displayName, data.email, data.password);
    onSuccess();
  };

  return (
    <View style={styles.form}>
      <FormField label="Full Name" error={errors.displayName?.message}>
        <Controller
          control={control}
          name="displayName"
          render={({ field: { value, onChange } }) => (
            <StyledInput
              value={value ?? ""}
              onChangeText={onChange}
              placeholder="Alex Johnson"
              autoCapitalize="words"
              autoComplete="name"
              hasError={!!errors.displayName}
            />
          )}
        />
      </FormField>
      <FormField label="Email" error={errors.email?.message}>
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange } }) => (
            <StyledInput
              value={value ?? ""}
              onChangeText={onChange}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              hasError={!!errors.email}
            />
          )}
        />
      </FormField>
      <FormField label="Password" error={errors.password?.message}>
        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange } }) => (
            <StyledInput
              value={value ?? ""}
              onChangeText={onChange}
              placeholder="8+ chars, uppercase & number"
              secureTextEntry
              autoComplete="new-password"
              hasError={!!errors.password}
            />
          )}
        />
      </FormField>
      <FormField label="Confirm Password" error={errors.confirmPassword?.message}>
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { value, onChange } }) => (
            <StyledInput
              value={value ?? ""}
              onChangeText={onChange}
              placeholder="Repeat password"
              secureTextEntry
              autoComplete="new-password"
              hasError={!!errors.confirmPassword}
            />
          )}
        />
      </FormField>
      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleSubmit(onSubmit)}
        disabled={loading}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={["#00B4D8", "#7B2CBF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.submitGradient}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Create Account</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

export default function AuthScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [appleAvailable, setAppleAvailable] = useState(false);
  const { error, clearError, signInWithApple, loading } = useAuthStore();
  const { signIn: googleSignIn } = useGoogleAuth();

  useEffect(() => {
    AuthService.isAppleAvailable().then(setAppleAvailable);
  }, []);

  const switchMode = async (m: AuthMode) => {
    clearError();
    await Haptics.selectionAsync();
    setMode(m);
  };

  const onAuthSuccess = () => {
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: C.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.header}>
          <LinearGradient colors={["#00B4D8", "#7B2CBF"]} style={styles.logo}>
            <Ionicons name="water" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.appName}>Liquid Impact</Text>
          <Text style={styles.tagline}>Your drink, decoded.</Text>
        </Animated.View>

        {/* Tab toggle */}
        <Animated.View
          entering={FadeInDown.delay(60).springify()}
          style={[styles.tabRow, { backgroundColor: C.backgroundSecondary }]}
        >
          {(["signin", "signup"] as AuthMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => switchMode(m)}
              activeOpacity={0.8}
              style={[
                styles.tab,
                mode === m && { backgroundColor: "rgba(0,180,216,0.15)", borderWidth: 1, borderColor: "rgba(0,180,216,0.30)" },
              ]}
            >
              <Text style={[styles.tabText, { color: mode === m ? "#00B4D8" : C.mutedForeground }]}>
                {m === "signin" ? "Sign In" : "Create Account"}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Error banner */}
        {error ? (
          <Animated.View entering={FadeInDown} exiting={FadeOutUp} style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#FF4D6D" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={clearError}>
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {/* Form */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          {mode === "signin" ? (
            <SignInForm onSuccess={onAuthSuccess} />
          ) : (
            <SignUpForm onSuccess={onAuthSuccess} />
          )}
        </Animated.View>

        {/* Divider */}
        <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={[styles.dividerText, { color: C.mutedForeground }]}>or continue with</Text>
          <View style={styles.dividerLine} />
        </Animated.View>

        {/* OAuth buttons */}
        <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.oauthRow}>
          <TouchableOpacity
            style={[styles.oauthBtn, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}
            onPress={googleSignIn}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={20} color="#fff" />
            <Text style={styles.oauthText}>Google</Text>
          </TouchableOpacity>

          {appleAvailable && (
            <TouchableOpacity
              style={[styles.oauthBtn, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}
              onPress={() => signInWithApple().catch(() => {})}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Ionicons name="logo-apple" size={20} color="#fff" />
              <Text style={styles.oauthText}>Apple</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Legal */}
        <Animated.View entering={FadeInDown.delay(220).springify()}>
          <Text style={[styles.legal, { color: C.mutedForeground }]}>
            By continuing you agree to our{" "}
            <Text
              style={{ color: C.primary }}
              onPress={() => router.push("/terms")}
            >
              Terms of Use
            </Text>
            {" "}and{" "}
            <Text
              style={{ color: C.primary }}
              onPress={() => router.push("/privacy")}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, gap: 20 },
  header: { alignItems: "center", gap: 8, marginBottom: 8 },
  logo: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
  },
  appName: { color: "#F0F0FF", fontSize: 26, fontWeight: "800" },
  tagline: { color: "rgba(255,255,255,0.45)", fontSize: 14 },
  tabRow: {
    flexDirection: "row", borderRadius: 14, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabText: { fontSize: 14, fontWeight: "700" },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,77,109,0.12)", borderWidth: 1,
    borderColor: "rgba(255,77,109,0.30)", borderRadius: 14, padding: 12,
  },
  errorText: { flex: 1, color: "#FF4D6D", fontSize: 13 },
  form: { gap: 12 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: "rgba(255,255,255,0.70)", fontSize: 13, fontWeight: "600" },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 16,
  },
  inputFocused: { borderColor: "rgba(0,180,216,0.50)", backgroundColor: "rgba(0,180,216,0.06)" },
  inputError: { borderColor: "rgba(255,77,109,0.50)" },
  input: { flex: 1, color: "#F0F0FF", fontSize: 15, paddingVertical: 14 },
  eyeBtn: { paddingLeft: 8 },
  fieldError: { color: "#FF4D6D", fontSize: 12 },
  submitBtn: { borderRadius: 16, overflow: "hidden", marginTop: 4 },
  submitGradient: { paddingVertical: 16, alignItems: "center", minHeight: 54 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  dividerText: { fontSize: 12 },
  oauthRow: { flexDirection: "row", gap: 12 },
  oauthBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  oauthText: { color: "#F0F0FF", fontSize: 14, fontWeight: "700" },
  legal: { fontSize: 11, textAlign: "center", lineHeight: 18 },
});
