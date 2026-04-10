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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, spacing, borderRadius } from "../../lib/theme";
import { Button, Input } from "../../components/ui";
import { trpc } from "../../lib/trpc";

export default function Step0BusinessBasics() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tradingName, setTradingName] = useState("");
  const [abn, setAbn] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [industryType, setIndustryType] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [teamSize, setTeamSize] = useState("");

  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    try {
      // Backend returns { profile, businessName, contactName, contactEmail, tradeType }
      const response = await (trpc as any).portal.getOnboardingProfile.query();
      const profile = response?.profile ?? {};
      setTradingName(profile.tradingName ?? "");
      setAbn(profile.abn ?? "");
      setPhone(profile.phone ?? "");
      setAddress(profile.address ?? "");
      setEmail(profile.email ?? "");
      setWebsite(profile.website ?? "");
      setIndustryType(profile.industryType ?? "");
      setYearsInBusiness(profile.yearsInBusiness?.toString() ?? "");
      setTeamSize(profile.teamSize?.toString() ?? "");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load profile";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = useCallback(async () => {
    setSaving(true);
    try {
      await (trpc as any).portal.saveOnboardingStep.mutate({
        step: 0,
        data: {
          tradingName,
          abn,
          phone,
          address,
          email,
          website,
          industryType,
          yearsInBusiness: yearsInBusiness ? parseInt(yearsInBusiness, 10) : undefined,
          teamSize: teamSize ? parseInt(teamSize, 10) : undefined,
        },
      });
      router.push("/onboarding/step-1");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  }, [
    tradingName, abn, phone, address, email, website,
    industryType, yearsInBusiness, teamSize, router,
  ]);

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
            <Text style={styles.stepIndicator}>Step 1 of 4</Text>
            <Text style={styles.title}>Business Basics</Text>
            <Text style={styles.subtitle}>
              Tell us about your business so we can set up your AI receptionist.
            </Text>
          </View>

          <Input
            label="Trading Name"
            value={tradingName}
            onChangeText={setTradingName}
            placeholder="e.g. Smith Plumbing"
          />
          <Input
            label="ABN"
            value={abn}
            onChangeText={setAbn}
            placeholder="e.g. 12 345 678 901"
            keyboardType="number-pad"
          />
          <Input
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 0412 345 678"
            keyboardType="phone-pad"
          />
          <Input
            label="Address"
            value={address}
            onChangeText={setAddress}
            placeholder="e.g. 123 Main St, Sydney NSW 2000"
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. hello@smithplumbing.com.au"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Website"
            value={website}
            onChangeText={setWebsite}
            placeholder="e.g. https://smithplumbing.com.au"
            keyboardType="url"
            autoCapitalize="none"
          />
          <Input
            label="Industry Type"
            value={industryType}
            onChangeText={setIndustryType}
            placeholder="e.g. Plumbing, Electrical, HVAC"
          />
          <Input
            label="Years in Business"
            value={yearsInBusiness}
            onChangeText={setYearsInBusiness}
            placeholder="e.g. 5"
            keyboardType="number-pad"
          />
          <Input
            label="Team Size"
            value={teamSize}
            onChangeText={setTeamSize}
            placeholder="e.g. 3"
            keyboardType="number-pad"
          />

          <View style={styles.footer}>
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
  footer: {
    marginTop: spacing.lg,
  },
});
