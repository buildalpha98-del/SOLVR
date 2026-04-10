import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  Switch,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, spacing, borderRadius } from "../../lib/theme";
import { Button, Input } from "../../components/ui";
import { trpc } from "../../lib/trpc";

export default function Step1ServicesPricing() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [servicesOffered, setServicesOffered] = useState<string[]>([""]);
  const [callOutFee, setCallOutFee] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [minimumCharge, setMinimumCharge] = useState("");
  const [afterHoursMultiplier, setAfterHoursMultiplier] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [operatingHours, setOperatingHours] = useState("");
  const [emergencyAvailable, setEmergencyAvailable] = useState(false);
  const [emergencyFee, setEmergencyFee] = useState("");

  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    try {
      // Backend returns { profile, businessName, contactName, contactEmail, tradeType }
      const response = await (trpc as any).portal.getOnboardingProfile.query();
      const profile = response?.profile ?? {};
      // servicesOffered is stored as Array<{name, description, typicalPrice, unit}> on the
      // backend; mobile's current step-1 UI uses string[] so we map for backward compat.
      if (Array.isArray(profile.servicesOffered) && profile.servicesOffered.length > 0) {
        const svc = profile.servicesOffered;
        const stringified: string[] = svc.map((s: unknown) =>
          typeof s === "string" ? s : (s as { name?: string })?.name ?? ""
        );
        setServicesOffered(stringified);
      }
      setCallOutFee(profile.callOutFee?.toString() ?? "");
      setHourlyRate(profile.hourlyRate?.toString() ?? "");
      setMinimumCharge(profile.minimumCharge?.toString() ?? "");
      setAfterHoursMultiplier(profile.afterHoursMultiplier?.toString() ?? "");
      setServiceArea(profile.serviceArea ?? "");
      // operatingHours is {monFri, sat, sun, publicHolidays} on backend; mobile uses a string
      if (profile.operatingHours && typeof profile.operatingHours === "object") {
        setOperatingHours(profile.operatingHours.monFri ?? "");
      } else if (typeof profile.operatingHours === "string") {
        setOperatingHours(profile.operatingHours);
      }
      setEmergencyAvailable(profile.emergencyAvailable ?? false);
      setEmergencyFee(profile.emergencyFee?.toString() ?? "");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load profile";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const addService = useCallback(() => {
    setServicesOffered((prev) => [...prev, ""]);
  }, []);

  const removeService = useCallback((index: number) => {
    setServicesOffered((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateService = useCallback((index: number, value: string) => {
    setServicesOffered((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  const handleContinue = useCallback(async () => {
    setSaving(true);
    try {
      const filteredServices = servicesOffered.filter((s) => s.trim() !== "");
      await (trpc as any).portal.saveOnboardingStep.mutate({
        step: 1,
        data: {
          servicesOffered: filteredServices,
          callOutFee: callOutFee ? parseFloat(callOutFee) : undefined,
          hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
          minimumCharge: minimumCharge ? parseFloat(minimumCharge) : undefined,
          afterHoursMultiplier: afterHoursMultiplier
            ? parseFloat(afterHoursMultiplier)
            : undefined,
          serviceArea,
          operatingHours,
          emergencyAvailable,
          emergencyFee: emergencyFee ? parseFloat(emergencyFee) : undefined,
        },
      });
      router.push("/onboarding/step-2");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  }, [
    servicesOffered, callOutFee, hourlyRate, minimumCharge,
    afterHoursMultiplier, serviceArea, operatingHours,
    emergencyAvailable, emergencyFee, router,
  ]);

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.stepIndicator}>Step 2 of 4</Text>
            <Text style={styles.title}>Services & Pricing</Text>
            <Text style={styles.subtitle}>
              Define what you offer and how you charge.
            </Text>
          </View>

          {/* Services list */}
          <Text style={styles.sectionLabel}>Services Offered</Text>
          {servicesOffered.map((service, index) => (
            <View key={index} style={styles.serviceRow}>
              <View style={{ flex: 1 }}>
                <Input
                  value={service}
                  onChangeText={(val) => updateService(index, val)}
                  placeholder={`Service ${index + 1}`}
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
              {servicesOffered.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeService(index)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={addService} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add Service</Text>
          </TouchableOpacity>

          {/* Pricing fields */}
          <Input
            label="Call-Out Fee ($)"
            value={callOutFee}
            onChangeText={setCallOutFee}
            placeholder="e.g. 80"
            keyboardType="decimal-pad"
          />
          <Input
            label="Hourly Rate ($)"
            value={hourlyRate}
            onChangeText={setHourlyRate}
            placeholder="e.g. 120"
            keyboardType="decimal-pad"
          />
          <Input
            label="Minimum Charge ($)"
            value={minimumCharge}
            onChangeText={setMinimumCharge}
            placeholder="e.g. 150"
            keyboardType="decimal-pad"
          />
          <Input
            label="After-Hours Multiplier"
            value={afterHoursMultiplier}
            onChangeText={setAfterHoursMultiplier}
            placeholder="e.g. 1.5"
            keyboardType="decimal-pad"
          />
          <Input
            label="Service Area"
            value={serviceArea}
            onChangeText={setServiceArea}
            placeholder="e.g. Sydney Metro, 30km radius"
          />
          <Input
            label="Operating Hours"
            value={operatingHours}
            onChangeText={setOperatingHours}
            placeholder="e.g. Mon-Fri 7am-5pm"
          />

          {/* Emergency toggle */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Emergency Available</Text>
              <Text style={styles.toggleSubtext}>
                Accept after-hours emergency calls
              </Text>
            </View>
            <Switch
              value={emergencyAvailable}
              onValueChange={setEmergencyAvailable}
              trackColor={{ false: colors.surface, true: colors.primary + "80" }}
              thumbColor={emergencyAvailable ? colors.primary : colors.textSecondary}
            />
          </View>

          {emergencyAvailable && (
            <Input
              label="Emergency Fee ($)"
              value={emergencyFee}
              onChangeText={setEmergencyFee}
              placeholder="e.g. 250"
              keyboardType="decimal-pad"
            />
          )}

          <View style={styles.footer}>
            <Button
              title="Back"
              onPress={handleBack}
              variant="secondary"
              style={{ marginBottom: spacing.sm }}
            />
            <Button
              title="Continue"
              onPress={handleContinue}
              loading={saving}
              disabled={saving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    marginBottom: spacing.sm,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  removeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
  addButton: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  toggleLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.bodySemiBold,
  },
  toggleSubtext: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
    marginTop: 2,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
