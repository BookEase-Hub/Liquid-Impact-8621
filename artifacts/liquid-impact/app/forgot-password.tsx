import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { AuthService } from "@/features/auth/service";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordData,
  type ResetPasswordData,
} from "@/features/auth/validation";

type Step = "email" | "reset";

function StyledInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  hasError,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "email-address" | "number-pad" | "default";
  hasError?: boolean;
}) {
  const C = useColors();
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View
      style={[
        styles.inputWrap,
        { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.10)" },
        focused && styles.inputFocused,
        hasError && styles.inputError,
      ]}
    >
      <TextInput
        style={[styles.input, { color: C.foreground }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.30)"
        secureTextEntry={isPassword && !showPassword}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {isPassword && (
        <TouchableOpacity
          onPress={() => setShowPassword((v) => !v)}
          style={styles.eyeBtn}
        >
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

function FieldWrap({
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

export default function ForgotPasswordScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const emailForm = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const resetForm = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSendCode = async (data: ForgotPasswordData) => {
    setLoading(true);
    setError(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await AuthService.forgotPassword(data.email);
      setEmail(data.email);
      if (result.devCode) setDevCode(result.devCode);
      setStep("reset");
    } catch (e: any) {
      setError(e.message ?? "Failed to send reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async (data: ResetPasswordData) => {
    setLoading(true);
    setError(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await AuthService.resetPassword(email, data.code, data.password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message ?? "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={[styles.root, { backgroundColor: C.background }]}>
        <View
          style={[
            styles.successContainer,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          ]}
        >
          <Animated.View entering={FadeInDown.springify()} style={styles.successContent}>
            <LinearGradient
              colors={["#00B4D8", "#7B2CBF"]}
              style={styles.successIcon}
            >
              <Ionicons name="checkmark" size={40} color="#fff" />
            </LinearGradient>
            <Text style={[styles.successTitle, { color: C.foreground }]}>
              Password Reset!
            </Text>
            <Text style={[styles.successBody, { color: C.mutedForeground }]}>
              Your password has been updated successfully. You can now sign in with your new password.
            </Text>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => router.replace("/auth")}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#00B4D8", "#7B2CBF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: C.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
          onPress={() => (step === "reset" ? setStep("email") : router.back())}
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
        <Text style={[styles.headerTitle, { color: C.foreground }]}>
          {step === "email" ? "Forgot Password" : "Reset Password"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: 32, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === "email" ? (
          <Animated.View entering={FadeInDown.springify()} style={{ gap: 24 }}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIconWrap}>
                <LinearGradient colors={["#00B4D8", "#7B2CBF"]} style={styles.stepIcon}>
                  <Ionicons name="key" size={28} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={[styles.stepTitle, { color: C.foreground }]}>
                Reset your password
              </Text>
              <Text style={[styles.stepDesc, { color: C.mutedForeground }]}>
                Enter your email address and we'll send you a 6-digit code to reset your password.
              </Text>
            </View>

            {error ? (
              <Animated.View
                entering={FadeInDown}
                exiting={FadeOutUp}
                style={styles.errorBanner}
              >
                <Ionicons name="alert-circle" size={16} color="#FF4D6D" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={() => setError(null)}>
                  <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </Animated.View>
            ) : null}

            <FieldWrap label="Email" error={emailForm.formState.errors.email?.message}>
              <Controller
                control={emailForm.control}
                name="email"
                render={({ field: { value, onChange } }) => (
                  <StyledInput
                    value={value ?? ""}
                    onChangeText={onChange}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    hasError={!!emailForm.formState.errors.email}
                  />
                )}
              />
            </FieldWrap>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={emailForm.handleSubmit(onSendCode)}
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
                  <Text style={styles.submitText}>Send Reset Code</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.springify()} style={{ gap: 24 }}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIconWrap}>
                <LinearGradient colors={["#00B4D8", "#7B2CBF"]} style={styles.stepIcon}>
                  <Ionicons name="lock-open" size={28} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={[styles.stepTitle, { color: C.foreground }]}>
                Enter your new password
              </Text>
              <Text style={[styles.stepDesc, { color: C.mutedForeground }]}>
                Check your email at{" "}
                <Text style={{ color: "#00B4D8" }}>{email}</Text>
                {" "}for the 6-digit code.
              </Text>
            </View>

            {devCode ? (
              <View
                style={{
                  padding: 14,
                  backgroundColor: "rgba(0,180,216,0.10)",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "rgba(0,180,216,0.25)",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Ionicons name="information-circle" size={18} color="#00B4D8" />
                <Text style={{ color: "#00B4D8", fontSize: 13, flex: 1 }}>
                  Dev mode — your code is: <Text style={{ fontWeight: "800" }}>{devCode}</Text>
                </Text>
              </View>
            ) : null}

            {error ? (
              <Animated.View
                entering={FadeInDown}
                exiting={FadeOutUp}
                style={styles.errorBanner}
              >
                <Ionicons name="alert-circle" size={16} color="#FF4D6D" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={() => setError(null)}>
                  <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </Animated.View>
            ) : null}

            <FieldWrap label="6-Digit Code" error={resetForm.formState.errors.code?.message}>
              <Controller
                control={resetForm.control}
                name="code"
                render={({ field: { value, onChange } }) => (
                  <StyledInput
                    value={value ?? ""}
                    onChangeText={onChange}
                    placeholder="000000"
                    keyboardType="number-pad"
                    hasError={!!resetForm.formState.errors.code}
                  />
                )}
              />
            </FieldWrap>

            <FieldWrap
              label="New Password"
              error={resetForm.formState.errors.password?.message}
            >
              <Controller
                control={resetForm.control}
                name="password"
                render={({ field: { value, onChange } }) => (
                  <StyledInput
                    value={value ?? ""}
                    onChangeText={onChange}
                    placeholder="8+ chars, uppercase & number"
                    secureTextEntry
                    hasError={!!resetForm.formState.errors.password}
                  />
                )}
              />
            </FieldWrap>

            <FieldWrap
              label="Confirm Password"
              error={resetForm.formState.errors.confirmPassword?.message}
            >
              <Controller
                control={resetForm.control}
                name="confirmPassword"
                render={({ field: { value, onChange } }) => (
                  <StyledInput
                    value={value ?? ""}
                    onChangeText={onChange}
                    placeholder="Repeat password"
                    secureTextEntry
                    hasError={!!resetForm.formState.errors.confirmPassword}
                  />
                )}
              />
            </FieldWrap>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={resetForm.handleSubmit(onResetPassword)}
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
                  <Text style={styles.submitText}>Reset Password</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setStep("email"); setError(null); }}
              style={{ alignItems: "center" }}
            >
              <Text style={{ color: "#00B4D8", fontSize: 13, fontWeight: "600" }}>
                Resend code
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  scroll: { paddingHorizontal: 24, gap: 0 },
  stepHeader: { alignItems: "center", gap: 12, marginBottom: 8 },
  stepIconWrap: { marginBottom: 4 },
  stepIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  stepTitle: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  stepDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,77,109,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,77,109,0.30)",
    borderRadius: 14,
    padding: 12,
  },
  errorText: { flex: 1, color: "#FF4D6D", fontSize: 13 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: "rgba(255,255,255,0.70)", fontSize: 13, fontWeight: "600" },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  inputFocused: {
    borderColor: "rgba(0,180,216,0.50)",
    backgroundColor: "rgba(0,180,216,0.06)",
  },
  inputError: { borderColor: "rgba(255,77,109,0.50)" },
  input: { flex: 1, fontSize: 15, paddingVertical: 14 },
  eyeBtn: { paddingLeft: 8 },
  fieldError: { color: "#FF4D6D", fontSize: 12 },
  submitBtn: { borderRadius: 16, overflow: "hidden", marginTop: 4 },
  submitGradient: { paddingVertical: 16, alignItems: "center", minHeight: 54 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  successContent: { alignItems: "center", gap: 20 },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  successTitle: { fontSize: 28, fontWeight: "800" },
  successBody: { fontSize: 15, textAlign: "center", lineHeight: 22 },
});
