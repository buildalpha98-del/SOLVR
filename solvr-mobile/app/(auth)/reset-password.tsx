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
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { trpc } from "../../lib/trpc";
import { colors, fonts, spacing, borderRadius } from "../../lib/theme";
import { Button, Input } from "../../components/ui";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  function validate(): boolean {
    const next: typeof errors = {};

    if (!newPassword) {
      next.newPassword = "Password is required";
    } else if (newPassword.length < 8) {
      next.newPassword = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      next.confirmPassword = "Please confirm your password";
    } else if (newPassword !== confirmPassword) {
      next.confirmPassword = "Passwords do not match";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleReset() {
    if (!validate()) return;

    if (!token) {
      Toast.show({
        type: "error",
        text1: "Invalid Link",
        text2: "This reset link is invalid or has expired.",
      });
      return;
    }

    setLoading(true);
    try {
      await (trpc as any).portal.resetPassword.mutate({
        token,
        newPassword,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to reset password. The link may have expired.";
      Toast.show({
        type: "error",
        text1: "Reset Failed",
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
            onPress={() => router.replace("/(auth)/login")}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          {success ? (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={48}
                  color={colors.success}
                />
              </View>
              <Text style={styles.title}>Password Reset</Text>
              <Text style={styles.description}>
                Your password has been successfully reset. You can now sign in
                with your new password.
              </Text>
              <Button
                title="Sign In"
                onPress={() => router.replace("/(auth)/login")}
                style={styles.actionButton}
              />
            </View>
          ) : (
            <View style={styles.formContainer}>
              <Text style={styles.title}>Set New Password</Text>
              <Text style={styles.description}>
                Choose a strong password with at least 8 characters.
              </Text>

              <Input
                label="New Password"
                placeholder="Enter new password"
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  if (errors.newPassword)
                    setErrors((prev) => ({ ...prev, newPassword: undefined }));
                }}
                error={errors.newPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
              />

              <Input
                label="Confirm Password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword)
                    setErrors((prev) => ({
                      ...prev,
                      confirmPassword: undefined,
                    }));
                }}
                error={errors.confirmPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleReset}
              />

              <Button
                title="Reset Password"
                onPress={handleReset}
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
                  Back to <Text style={styles.loginLinkAccent}>Sign In</Text>
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
