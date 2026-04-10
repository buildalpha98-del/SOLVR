import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useAuth } from "../../../lib/auth";
import { trpc } from "../../../lib/trpc";
import { colors, fonts, spacing, borderRadius } from "../../../lib/theme";
import { Button, Input, Card, Badge, SectionHeader } from "../../../components/ui";
import {
  registerForPushNotifications,
  unregisterPushNotifications,
} from "../../../lib/pushNotifications";

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={collapsibleStyles.wrapper}>
      <TouchableOpacity
        onPress={() => setOpen((p) => !p)}
        activeOpacity={0.7}
        style={collapsibleStyles.header}
      >
        <Text style={collapsibleStyles.title}>{title}</Text>
        <Text style={collapsibleStyles.chevron}>{open ? "−" : "+"}</Text>
      </TouchableOpacity>
      {open && <View style={collapsibleStyles.body}>{children}</View>}
    </View>
  );
}

const collapsibleStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
  },
  title: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  chevron: {
    fontFamily: fonts.titleBold,
    fontSize: 20,
    color: colors.textSecondary,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});

// ---------------------------------------------------------------------------
// Settings Screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  // ---- Business Profile ----
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [tradingName, setTradingName] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizWebsite, setBizWebsite] = useState("");

  // ---- Payment Details (bank fields live on portal.getBusinessProfile) ----
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankBsb, setBankBsb] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Backend returns { profile } - destructure it
        const response = await (trpc as any).portal.getFullProfile.query();
        const profile = response?.profile ?? response ?? {};
        if (cancelled) return;
        setTradingName(profile.tradingName || "");
        setBizPhone(profile.phone || "");
        setBizEmail(profile.email || "");
        setBizAddress(profile.address || "");
        setBizWebsite(profile.website || "");
      } catch {
        // silently fail - profile may not exist yet
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Separate effect for bank fields — they live on getBusinessProfile (not getFullProfile).
  // This is a post-Manus backend change; if the production deploy lags, these calls will
  // return empty strings but won't crash.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const business = await (trpc as any).portal.getBusinessProfile.query();
        if (cancelled) return;
        setBankName(business?.bankName ?? "");
        setBankAccountName(business?.bankAccountName ?? "");
        setBankBsb(business?.bankBsb ?? "");
        setBankAccountNumber(business?.bankAccountNumber ?? "");
      } catch {
        // Older backend may not support bank fields yet — silently fall back to empty.
      } finally {
        if (!cancelled) setPaymentLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveProfile = useCallback(async () => {
    setProfileSaving(true);
    try {
      await (trpc as any).portal.updateFullProfile.mutate({
        tradingName,
        phone: bizPhone,
        email: bizEmail,
        address: bizAddress,
        website: bizWebsite,
      });
      Alert.alert("Saved", "Business profile updated.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save profile.");
    } finally {
      setProfileSaving(false);
    }
  }, [tradingName, bizPhone, bizEmail, bizAddress, bizWebsite]);

  // Save bank fields via updateBusinessProfile (mirrors the web app's PortalSettings
  // Payment Details section added in the Manus backend changes).
  const savePayment = useCallback(async () => {
    // Basic BSB validation — must be 6 digits (Australian format)
    const bsbDigits = bankBsb.replace(/\D/g, "");
    if (bankBsb && bsbDigits.length !== 6) {
      Alert.alert("Validation", "BSB must be 6 digits (e.g. 062-000).");
      return;
    }

    setPaymentSaving(true);
    try {
      await (trpc as any).portal.updateBusinessProfile.mutate({
        bankName: bankName || undefined,
        bankAccountName: bankAccountName || undefined,
        bankBsb: bankBsb || undefined,
        bankAccountNumber: bankAccountNumber || undefined,
      });
      Alert.alert("Saved", "Payment details updated. These will appear on your invoices.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save payment details.");
    } finally {
      setPaymentSaving(false);
    }
  }, [bankName, bankAccountName, bankBsb, bankAccountNumber]);

  // ---- Change Password ----
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const changePassword = useCallback(async () => {
    if (newPassword.length < 8) {
      Alert.alert("Validation", "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Validation", "New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await (trpc as any).portal.changePassword.mutate({
        currentPassword,
        newPassword,
      });
      Alert.alert("Success", "Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to change password.");
    } finally {
      setPasswordSaving(false);
    }
  }, [currentPassword, newPassword, confirmPassword]);

  // ---- Push Notifications ----
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushToggling, setPushToggling] = useState(false);

  const togglePush = useCallback(
    async (value: boolean) => {
      setPushToggling(true);
      try {
        if (value) {
          const token = await registerForPushNotifications();
          if (!token) {
            Alert.alert(
              "Permission Denied",
              "Push notification permission was not granted."
            );
            setPushToggling(false);
            return;
          }
          setPushEnabled(true);
        } else {
          await unregisterPushNotifications();
          setPushEnabled(false);
        }
      } catch (err: any) {
        Alert.alert("Error", err?.message || "Failed to update notifications.");
      } finally {
        setPushToggling(false);
      }
    },
    []
  );

  // ---- Sign Out ----
  const handleSignOut = useCallback(async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
            router.replace("/(auth)/login");
          } catch {
            Alert.alert("Error", "Failed to sign out.");
          }
        },
      },
    ]);
  }, [logout, router]);

  // ---- App version ----
  // Constants.manifest is legacy and removed in newer expo-constants; expoConfig.version is the source of truth.
  const appVersion = Constants.expoConfig?.version || "1.0.0";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(user?.contactName || user?.businessName || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.contactName || "User"}</Text>
            <Text style={styles.profileEmail}>{user?.businessName || ""}</Text>
            {user?.plan && (
              <Badge
                label={user.plan}
                color={colors.primary}
              />
            )}
          </View>
        </Card>

        {/* Business Profile */}
        <SectionHeader title="Business Profile" />
        <CollapsibleSection title="Edit Business Details">
          {profileLoading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ paddingVertical: spacing.md }}
            />
          ) : (
            <>
              <Input
                label="Trading Name"
                value={tradingName}
                onChangeText={setTradingName}
                placeholder="Your business name"
              />
              <Input
                label="Phone"
                value={bizPhone}
                onChangeText={setBizPhone}
                keyboardType="phone-pad"
                placeholder="Business phone"
              />
              <Input
                label="Email"
                value={bizEmail}
                onChangeText={setBizEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Business email"
              />
              <Input
                label="Address"
                value={bizAddress}
                onChangeText={setBizAddress}
                placeholder="Business address"
              />
              <Input
                label="Website"
                value={bizWebsite}
                onChangeText={setBizWebsite}
                keyboardType="url"
                autoCapitalize="none"
                placeholder="https://example.com"
              />
              <Button
                title="Save Profile"
                onPress={saveProfile}
                loading={profileSaving}
              />
            </>
          )}
        </CollapsibleSection>

        {/* Payment Details — auto-populates the bank section on invoice PDFs */}
        <CollapsibleSection title="Payment Details">
          {paymentLoading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ paddingVertical: spacing.md }}
            />
          ) : (
            <>
              <Text style={styles.helpText}>
                These details appear on your invoice PDFs so customers know where to pay.
              </Text>
              <Input
                label="Bank Name"
                value={bankName}
                onChangeText={setBankName}
                placeholder="e.g. Commonwealth Bank"
              />
              <Input
                label="Account Name"
                value={bankAccountName}
                onChangeText={setBankAccountName}
                placeholder="e.g. Smith's Plumbing Pty Ltd"
              />
              <Input
                label="BSB"
                value={bankBsb}
                onChangeText={setBankBsb}
                keyboardType="number-pad"
                placeholder="e.g. 062-000"
              />
              <Input
                label="Account Number"
                value={bankAccountNumber}
                onChangeText={setBankAccountNumber}
                keyboardType="number-pad"
                placeholder="e.g. 12345678"
              />
              <Button
                title="Save Payment Details"
                onPress={savePayment}
                loading={paymentSaving}
              />
            </>
          )}
        </CollapsibleSection>

        {/* Change Password */}
        <SectionHeader title="Security" />
        <CollapsibleSection title="Change Password">
          <Input
            label="Current Password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder="Enter current password"
          />
          <Input
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="Min 8 characters"
          />
          <Input
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Re-enter new password"
            error={
              confirmPassword && newPassword !== confirmPassword
                ? "Passwords do not match"
                : undefined
            }
          />
          <Button
            title="Update Password"
            onPress={changePassword}
            loading={passwordSaving}
            disabled={
              !currentPassword || !newPassword || !confirmPassword
            }
          />
        </CollapsibleSection>

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <Card style={styles.notifCard}>
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>Push Notifications</Text>
              <Text style={styles.notifSubtitle}>
                Receive alerts for new jobs, quotes, and messages
              </Text>
            </View>
            {pushToggling ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Switch
                value={pushEnabled}
                onValueChange={togglePush}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + "80",
                }}
                thumbColor={pushEnabled ? colors.primary : colors.textSecondary}
              />
            )}
          </View>
        </Card>

        {/* Sign Out */}
        <View style={styles.signOutSection}>
          <Button
            title="Sign Out"
            variant="danger"
            onPress={handleSignOut}
          />
        </View>

        {/* App Version */}
        <Text style={styles.versionText}>Version {appVersion}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 120,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontFamily: fonts.titleBold,
    fontSize: 28,
    color: colors.textPrimary,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary + "20",
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    fontFamily: fonts.titleBold,
    fontSize: 22,
    color: colors.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontFamily: fonts.titleSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  profileEmail: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  helpText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  notifCard: {
    padding: spacing.md,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  notifTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  notifSubtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  signOutSection: {
    marginTop: spacing.xl,
  },
  versionText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
