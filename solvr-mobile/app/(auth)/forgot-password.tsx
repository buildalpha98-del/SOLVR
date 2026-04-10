import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { trpc } from "../../lib/trpc";
import { colors, fonts, spacing, borderRadius } from "../../lib/theme";
import { Button, Input } from "../../components/ui";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();

  function validate(): boolean {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setEmailError("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address");
      return false;
    }
    setEmailError(undefined);
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setLoading(true);
    try {
      await (trpc as any).portal.forgotPassword.mutate({
        email: email.trim().toLowerCase(),
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      Toast.show({
        type: "error",
        text1: "Error",
        text2: message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          {submitted ? (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons
                  name="mail-outline"
                  size={48}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.title}>Check Your Email</Text>
              <Text style={styles.description}>
                If an account exists for{" "}
                <Text style={styles.emailHighlight}>
                  {email.trim().toLowerCase()}
                </Text>
                , we've sent a password reset link. Please check your inbox and
                spam folder.
              </Text>
              <Button
                title="Back to Login"
                onPress={() => router.replace("/(auth)/login")}
                style={styles.actionButton}
              />
            </View>
          ) : (
            <View style={styles.formContainer}>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.description}>
                Enter the email address associated with your account and we'll
                send you a link to reset your password.
              </Text>

              <Input
                label="Email"
                placeholder="you@company.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (emailError) setEmailError(undefined);
                }}
                error={emailError}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />

              <Button
                title="Send Reset Link"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                style={styles.actionButton}
              />

              <TouchableOpacity
                onPress={() => router.replace("/(auth)/login")}
                style={styles.loginLink}
                activeOpacity={0.7}
              >
                <Text style={styles.loginLinkText}>
                  Remember your password?{" "}
                  <Text style={styles.loginLinkAccent}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  backButton: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  formContainer: {
    flex: 1,
    justifyContent: "center",
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.titleBold,
    fontSize: 28,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  description: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
    textAlign: "center",
  },
  emailHighlight: {
    fontFamily: fonts.bodySemiBold,
    color: colors.textPrimary,
  },
  actionButton: {
    marginTop: spacing.sm,
  },
  loginLink: {
    alignSelf: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  loginLinkText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  loginLinkAccent: {
    fontFamily: fonts.bodySemiBold,
    color: colors.primary,
  },
});
