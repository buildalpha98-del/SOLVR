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
  TouchableOpacity,
  Image,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { colors, fonts, spacing, borderRadius } from "../../lib/theme";
import { Button, Input } from "../../components/ui";
import { trpc } from "../../lib/trpc";

const TONE_OPTIONS = ["professional", "friendly", "casual", "technical"] as const;
type ToneOfVoice = (typeof TONE_OPTIONS)[number];

export default function Step2Branding() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [tagline, setTagline] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState<ToneOfVoice>("professional");
  const [tonePickerVisible, setTonePickerVisible] = useState(false);

  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    try {
      // Backend returns { profile, businessName, contactName, contactEmail, tradeType }
      const response = await (trpc as any).portal.getOnboardingProfile.query();
      const profile = response?.profile ?? {};
      setLogoUrl(profile.logoUrl ?? "");
      setPrimaryColor(profile.primaryColor ?? "");
      setSecondaryColor(profile.secondaryColor ?? "");
      setTagline(profile.tagline ?? "");
      if (profile.toneOfVoice) {
        setToneOfVoice(profile.toneOfVoice as ToneOfVoice);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load profile";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant photo library access to upload your logo."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setLogoUrl(result.assets[0].uri);
    }
  }, []);

  const handleContinue = useCallback(async () => {
    setSaving(true);
    try {
      await (trpc as any).portal.saveOnboardingStep.mutate({
        step: 2,
        data: {
          logoUrl,
          primaryColor,
          secondaryColor,
          tagline,
          toneOfVoice,
        },
      });
      router.push("/onboarding/step-3");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  }, [logoUrl, primaryColor, secondaryColor, tagline, toneOfVoice, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const isValidHex = (hex: string): boolean => {
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
  };

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
            <Text style={styles.stepIndicator}>Step 3 of 4</Text>
            <Text style={styles.title}>Branding</Text>
            <Text style={styles.subtitle}>
              Customize how your AI receptionist represents your brand.
            </Text>
          </View>

          {/* Logo upload */}
          <Text style={styles.sectionLabel}>Logo</Text>
          <TouchableOpacity onPress={pickImage} style={styles.logoContainer}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderIcon}>+</Text>
                <Text style={styles.logoPlaceholderText}>Tap to upload logo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Color inputs */}
          <View style={styles.colorRow}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Input
                label="Primary Color"
                value={primaryColor}
                onChangeText={setPrimaryColor}
                placeholder="#F5A623"
                autoCapitalize="none"
              />
            </View>
            {isValidHex(primaryColor) && (
              <View
                style={[styles.colorPreview, { backgroundColor: primaryColor }]}
              />
            )}
          </View>

          <View style={styles.colorRow}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Input
                label="Secondary Color"
                value={secondaryColor}
                onChangeText={setSecondaryColor}
                placeholder="#0A1628"
                autoCapitalize="none"
              />
            </View>
            {isValidHex(secondaryColor) && (
              <View
                style={[styles.colorPreview, { backgroundColor: secondaryColor }]}
              />
            )}
          </View>

          <Input
            label="Tagline"
            value={tagline}
            onChangeText={setTagline}
            placeholder="e.g. Your trusted local plumber"
          />

          {/* Tone of voice picker */}
          <Text style={styles.sectionLabel}>Tone of Voice</Text>
          <TouchableOpacity
            onPress={() => setTonePickerVisible(true)}
            style={styles.pickerButton}
          >
            <Text style={styles.pickerButtonText}>
              {toneOfVoice.charAt(0).toUpperCase() + toneOfVoice.slice(1)}
            </Text>
            <Text style={styles.pickerChevron}>&#9662;</Text>
          </TouchableOpacity>

          <Modal
            visible={tonePickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setTonePickerVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setTonePickerVisible(false)}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Tone</Text>
                <FlatList
                  data={TONE_OPTIONS}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.modalOption,
                        item === toneOfVoice && styles.modalOptionActive,
                      ]}
                      onPress={() => {
                        setToneOfVoice(item);
                        setTonePickerVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalOptionText,
                          item === toneOfVoice && styles.modalOptionTextActive,
                        ]}
                      >
                        {item.charAt(0).toUpperCase() + item.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>

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
  logoContainer: {
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlaceholderIcon: {
    color: colors.primary,
    fontSize: 32,
    fontFamily: fonts.titleBold,
    marginBottom: spacing.xs,
  },
  logoPlaceholderText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    textAlign: "center",
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  colorPreview: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  pickerButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  pickerButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.bodyRegular,
  },
  pickerChevron: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    width: "100%",
    maxWidth: 340,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: fonts.titleSemiBold,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  modalOptionActive: {
    backgroundColor: colors.primary + "20",
  },
  modalOptionText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.bodyRegular,
  },
  modalOptionTextActive: {
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
