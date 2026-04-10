import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, spacing, borderRadius } from "../../lib/theme";
import { Button, Card } from "../../components/ui";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../lib/auth";

// Shape matches drizzle/schema.ts → clientProfiles.
// Backend decimals come back as STRINGS, JSON fields as objects/arrays.
interface OnboardingProfile {
  tradingName?: string | null;
  abn?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  website?: string | null;
  industryType?: string | null;
  yearsInBusiness?: number | null;
  teamSize?: number | null;
  servicesOffered?:
    | Array<{ name: string; description?: string; typicalPrice?: number | null; unit?: string }>
    | string[]
    | null;
  callOutFee?: string | number | null;
  hourlyRate?: string | number | null;
  minimumCharge?: string | number | null;
  afterHoursMultiplier?: string | number | null;
  serviceArea?: string | null;
  operatingHours?: { monFri?: string; sat?: string; sun?: string; publicHolidays?: string } | string | null;
  emergencyAvailable?: boolean | null;
  emergencyFee?: string | number | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  tagline?: string | null;
  toneOfVoice?: string | null;
}

function SummaryRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === "") return null;
  const displayValue = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{displayValue}</Text>
    </View>
  );
}

export default function Step3ReviewActivate() {
  const router = useRouter();
  const { refetchUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // Backend returns { profile, businessName, contactName, contactEmail, tradeType }
      const response = await (trpc as any).portal.getOnboardingProfile.query();
      setProfile(response?.profile ?? null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load profile";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = useCallback(async () => {
    setActivating(true);
    try {
      await (trpc as any).portal.completeOnboarding.mutate();
      await refetchUser();
      router.replace("/(portal)/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Activation failed";
      Alert.alert("Error", message);
    } finally {
      setActivating(false);
    }
  }, [refetchUser, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.stepIndicator}>Step 4 of 4</Text>
          <Text style={styles.title}>Review & Activate</Text>
          <Text style={styles.subtitle}>
            Check everything looks right, then activate your AI receptionist.
          </Text>
        </View>

        {/* Business Basics */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Business Basics</Text>
          <SummaryRow label="Trading Name" value={profile?.tradingName} />
          <SummaryRow label="ABN" value={profile?.abn} />
          <SummaryRow label="Phone" value={profile?.phone} />
          <SummaryRow label="Address" value={profile?.address} />
          <SummaryRow label="Email" value={profile?.email} />
          <SummaryRow label="Website" value={profile?.website} />
          <SummaryRow label="Industry" value={profile?.industryType} />
          <SummaryRow label="Years in Business" value={profile?.yearsInBusiness} />
          <SummaryRow label="Team Size" value={profile?.teamSize} />
        </Card>

        {/* Services & Pricing */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Services & Pricing</Text>
          {profile?.servicesOffered && profile.servicesOffered.length > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Services</Text>
              <Text style={styles.summaryValue}>
                {(profile.servicesOffered as Array<string | { name?: string }>)
                  .map((s) => (typeof s === "string" ? s : s?.name ?? ""))
                  .filter((s) => s.length > 0)
                  .join(", ")}
              </Text>
            </View>
          )}
          <SummaryRow label="Call-Out Fee" value={profile?.callOutFee != null ? `$${profile.callOutFee}` : undefined} />
          <SummaryRow label="Hourly Rate" value={profile?.hourlyRate != null ? `$${profile.hourlyRate}` : undefined} />
          <SummaryRow label="Minimum Charge" value={profile?.minimumCharge != null ? `$${profile.minimumCharge}` : undefined} />
          <SummaryRow label="After-Hours Multiplier" value={profile?.afterHoursMultiplier != null ? `${profile.afterHoursMultiplier}x` : undefined} />
          <SummaryRow label="Service Area" value={profile?.serviceArea ?? undefined} />
          <SummaryRow
            label="Operating Hours"
            value={
              profile?.operatingHours && typeof profile.operatingHours === "object"
                ? profile.operatingHours.monFri ?? undefined
                : (profile?.operatingHours as string | undefined)
            }
          />
          <SummaryRow label="Emergency Available" value={profile?.emergencyAvailable ?? undefined} />
          <SummaryRow label="Emergency Fee" value={profile?.emergencyFee != null ? `$${profile.emergencyFee}` : undefined} />
        </Card>

        {/* Branding */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Branding</Text>
          {profile?.logoUrl ? (
            <View style={styles.logoPreviewContainer}>
              <Image
                source={{ uri: profile.logoUrl }}
                style={styles.logoPreview}
              />
            </View>
          ) : null}
          {profile?.primaryColor && (
            <View style={styles.colorSummaryRow}>
              <Text style={styles.summaryLabel}>Primary Color</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View
                  style={[
                    styles.colorDot,
                    { backgroundColor: profile.primaryColor },
                  ]}
                />
                <Text style={styles.summaryValue}>{profile.primaryColor}</Text>
              </View>
            </View>
          )}
          {profile?.secondaryColor && (
            <View style={styles.colorSummaryRow}>
              <Text style={styles.summaryLabel}>Secondary Color</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View
                  style={[
                    styles.colorDot,
                    { backgroundColor: profile.secondaryColor },
                  ]}
                />
                <Text style={styles.summaryValue}>{profile.secondaryColor}</Text>
              </View>
            </View>
          )}
          <SummaryRow label="Tagline" value={profile?.tagline} />
          <SummaryRow
            label="Tone of Voice"
            value={
              profile?.toneOfVoice
                ? profile.toneOfVoice.charAt(0).toUpperCase() + profile.toneOfVoice.slice(1)
                : undefined
            }
          />
        </Card>

        <View style={styles.footer}>
          <Button
            title="Back"
            onPress={handleBack}
            variant="secondary"
            style={{ marginBottom: spacing.sm }}
          />
          <Button
            title={activating ? "Activating..." : "Activate My AI Receptionist"}
            onPress={handleActivate}
            loading={activating}
            disabled={activating}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  stepIndicator: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontFamily: fonts.titleBold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    lineHeight: 22,
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: fonts.titleSemiBold,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs + 2,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    flex: 1,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    flex: 1,
    textAlign: "right",
  },
  logoPreviewContainer: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  logoPreview: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs + 2,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
