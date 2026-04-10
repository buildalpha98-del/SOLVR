import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, borderRadius } from "../../../lib/theme";
import { Badge } from "../../../components/ui";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callTypeBadgeColor(type: string): string {
  switch (type.toLowerCase()) {
    case "missed":
      return colors.danger;
    case "completed":
      return colors.success;
    case "voicemail":
      return colors.warning;
    case "inbound":
      return colors.success;
    case "outbound":
      return colors.primary;
    default:
      return colors.textSecondary;
  }
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Call Detail Screen
// ---------------------------------------------------------------------------

export default function CallDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    body: string;
    type: string;
    createdAt: string;
  }>();

  const { title, body, type, createdAt } = params;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ---- Top Bar ---- */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          <Text style={styles.backLabel}>Calls</Text>
        </TouchableOpacity>
      </View>

      {/* ---- Content ---- */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Type badge */}
        {type ? (
          <Badge label={type} color={callTypeBadgeColor(type)} />
        ) : null}

        {/* Title */}
        <Text style={styles.title}>{title || "Untitled Call"}</Text>

        {/* Timestamp */}
        {createdAt ? (
          <Text style={styles.timestamp}>{formatTimestamp(createdAt)}</Text>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Body */}
        <Text style={styles.body}>
          {body || "No details available for this call."}
        </Text>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginLeft: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  title: {
    fontFamily: fonts.titleBold,
    fontSize: 24,
    color: colors.textPrimary,
    marginTop: spacing.md,
    lineHeight: 32,
  },
  timestamp: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  body: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 24,
  },
});
