import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { trpc } from "../../../lib/trpc";
import { useAuth } from "../../../lib/auth";
import { colors, fonts, spacing, borderRadius } from "../../../lib/theme";
import {
  Card,
  Badge,
  Button,
  Input,
  EmptyState,
  Skeleton,
} from "../../../components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JobStage = "new_lead" | "quoted" | "booked" | "completed" | "lost";

/**
 * Mirrors drizzle/schema.ts → portalJobs (what backend `listJobs` returns directly).
 * Field names MUST match backend shape — job.id is a number, jobType/callerName
 * are the real column names (NOT title/customerName).
 */
interface Job {
  id: number;
  clientId: number;
  jobType: string;
  description?: string | null;
  callerName?: string | null;
  callerPhone?: string | null;
  location?: string | null;
  stage: JobStage;
  estimatedValue?: number | null;
  actualValue?: number | null;
  preferredDate?: string | null;
  notes?: string | null;
  quotedAmount?: string | null;
  sourceQuoteId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stageBadgeColor(stage: JobStage): string {
  switch (stage) {
    case "new_lead":
      return "#3B82F6"; // blue
    case "quoted":
      return colors.warning;
    case "booked":
      return colors.success;
    case "completed":
      return colors.success;
    case "lost":
      return colors.danger;
    default:
      return colors.textSecondary;
  }
}

function stageLabel(stage: JobStage): string {
  switch (stage) {
    case "new_lead":
      return "New Lead";
    case "quoted":
      return "Quoted";
    case "booked":
      return "Booked";
    case "completed":
      return "Completed";
    case "lost":
      return "Lost";
    default:
      return stage;
  }
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------

function JobsSkeleton() {
  return (
    <View style={{ padding: spacing.md }}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton width={80} height={20} />
          <Skeleton width="70%" height={16} style={{ marginTop: spacing.sm }} />
          <Skeleton width="50%" height={14} style={{ marginTop: spacing.xs }} />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Job Row
// ---------------------------------------------------------------------------

function JobRow({
  item,
  onLongPress,
}: {
  item: Job;
  onLongPress: () => void;
}) {
  // Prefer actualValue (for completed jobs) over estimatedValue
  const displayValue = item.actualValue ?? item.estimatedValue ?? null;
  return (
    <Card style={styles.jobCard}>
      <TouchableOpacity
        activeOpacity={0.7}
        onLongPress={onLongPress}
        delayLongPress={500}
      >
        <View style={styles.jobHeader}>
          <Badge label={stageLabel(item.stage)} color={stageBadgeColor(item.stage)} />
          {displayValue != null && displayValue > 0 ? (
            <Text style={styles.jobValue}>{formatCurrency(displayValue)}</Text>
          ) : null}
        </View>
        <Text style={styles.jobTitle} numberOfLines={1}>
          {item.jobType}
        </Text>
        {item.callerName ? (
          <Text style={styles.jobCustomer} numberOfLines={1}>
            {item.callerName}
          </Text>
        ) : null}
      </TouchableOpacity>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Create Job Modal
// ---------------------------------------------------------------------------

/**
 * Form fields match backend createJob input schema:
 *   { jobType, description?, callerName?, callerPhone?, location?, estimatedValue?, preferredDate? }
 * Backend does NOT accept `stage` on create — new jobs are always `new_lead`.
 */
interface CreateJobFormData {
  jobType: string;
  callerName: string;
  estimatedValue: string;
}

const INITIAL_FORM: CreateJobFormData = {
  jobType: "",
  callerName: "",
  estimatedValue: "",
};

function CreateJobModal({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateJobFormData) => void;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<CreateJobFormData>(INITIAL_FORM);

  const handleClose = useCallback(() => {
    setForm(INITIAL_FORM);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    if (!form.jobType.trim()) {
      Alert.alert("Validation", "Job type is required.");
      return;
    }
    onSubmit(form);
  }, [form, onSubmit]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalContainer}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Job</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <Input
              label="Job Type"
              placeholder="e.g. Kitchen Renovation"
              value={form.jobType}
              onChangeText={(text) => setForm((f) => ({ ...f, jobType: text }))}
              autoFocus
            />

            <Input
              label="Customer Name"
              placeholder="e.g. John Smith"
              value={form.callerName}
              onChangeText={(text) =>
                setForm((f) => ({ ...f, callerName: text }))
              }
            />

            <Input
              label="Estimated Value ($)"
              placeholder="e.g. 5000"
              value={form.estimatedValue}
              onChangeText={(text) => setForm((f) => ({ ...f, estimatedValue: text }))}
              keyboardType="numeric"
            />

            <Button
              title={isSubmitting ? "Creating..." : "Create Job"}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={{ marginTop: spacing.lg }}
            />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Jobs List Screen
// ---------------------------------------------------------------------------

export default function JobsScreen() {
  const { hasFeature } = useAuth();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---- Feature gate ----
  const canAccessJobs = hasFeature("jobs");

  // ---- Fetch jobs ----
  const fetchJobs = useCallback(async () => {
    try {
      const result = await (trpc as any).portal.listJobs.query();
      const items: Job[] = Array.isArray(result) ? result : result?.items ?? result?.jobs ?? [];
      setJobs(items);
    } catch {
      setJobs([]);
    }
  }, []);

  useEffect(() => {
    if (!canAccessJobs) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    fetchJobs().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [canAccessJobs, fetchJobs]);

  // ---- Pull to refresh ----
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchJobs();
    setIsRefreshing(false);
  }, [fetchJobs]);

  // ---- Create job ----
  const handleCreateJob = useCallback(
    async (data: CreateJobFormData) => {
      setIsSubmitting(true);
      try {
        const parsedValue = data.estimatedValue
          ? parseInt(data.estimatedValue, 10)
          : undefined;
        await (trpc as any).portal.createJob.mutate({
          jobType: data.jobType.trim(),
          callerName: data.callerName.trim() || undefined,
          estimatedValue:
            parsedValue != null && !Number.isNaN(parsedValue) ? parsedValue : undefined,
        });
        setModalVisible(false);
        await fetchJobs();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to create job.";
        Alert.alert("Error", message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [fetchJobs],
  );

  // ---- Delete job ----
  const handleDeleteJob = useCallback(
    (job: Job) => {
      Alert.alert("Delete Job", `Are you sure you want to delete "${job.jobType}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Backend zod schema requires id as NUMBER, not string
              await (trpc as any).portal.deleteJob.mutate({ id: Number(job.id) });
              setJobs((prev) => prev.filter((j) => j.id !== job.id));
            } catch (err: unknown) {
              const message =
                err instanceof Error ? err.message : "Failed to delete job.";
              Alert.alert("Error", message);
            }
          },
        },
      ]);
    },
    [],
  );

  // ---- Render ----
  const renderItem = useCallback(
    ({ item }: { item: Job }) => (
      <JobRow item={item} onLongPress={() => handleDeleteJob(item)} />
    ),
    [handleDeleteJob],
  );

  // FlatList keyExtractor must return string — job.id is a number
  const keyExtractor = useCallback((item: Job) => String(item.id), []);

  // ---- Feature gate UI ----
  if (!canAccessJobs) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Jobs</Text>
        </View>
        <EmptyState
          icon="🔒"
          title="Jobs Unavailable"
          subtitle="Upgrade your plan to access job tracking and management."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jobs</Text>
      </View>

      {isLoading ? (
        <JobsSkeleton />
      ) : (
        <FlatList
          data={jobs}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="🔧"
              title="No jobs yet"
              subtitle="Tap the + button to create your first job."
            />
          }
        />
      )}

      {/* ---- FAB ---- */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* ---- Create Job Modal ---- */}
      <CreateJobModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleCreateJob}
        isSubmitting={isSubmitting}
      />
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
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontFamily: fonts.titleBold,
    fontSize: 28,
    color: colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  jobCard: {
    marginBottom: spacing.sm,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  jobTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  jobCustomer: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  jobValue: {
    fontFamily: fonts.titleSemiBold,
    fontSize: 15,
    color: colors.success,
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  // FAB
  fab: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: colors.background,
    fontWeight: "700",
    marginTop: -2,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCancel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.primary,
  },
  modalTitle: {
    fontFamily: fonts.titleSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },

  // Stage chips
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    marginBottom: spacing.xs,
  },
  stageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stageChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stageChipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
