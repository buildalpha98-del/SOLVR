import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Audio } from "expo-av";
import { trpc } from "../../../lib/trpc";
import { uploadAudio } from "../../../lib/api";
import { colors, fonts, spacing, borderRadius } from "../../../lib/theme";
import { Card, Badge, EmptyState, SectionHeader } from "../../../components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Quote {
  id: string;
  title?: string;
  jobTitle?: string;
  customerName?: string;
  status: string;
  totalAmount?: number;
  createdAt: string;
}

type RecordingState = "idle" | "recording" | "processing" | "done";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number | undefined): string {
  if (amount == null) return "$0.00";
  return `$${amount.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function statusBadgeColor(status: string): string {
  switch (status.toLowerCase()) {
    case "draft":
      return colors.textSecondary;
    case "sent":
      return "#3B82F6";
    case "accepted":
      return colors.success;
    case "declined":
      return colors.danger;
    default:
      return colors.textSecondary;
  }
}

// ---------------------------------------------------------------------------
// Waveform Visualizer
// ---------------------------------------------------------------------------

const WAVEFORM_BARS = 20;

function WaveformVisualizer({ metering }: { metering: number }) {
  const bars = useRef(
    Array.from({ length: WAVEFORM_BARS }, () => new Animated.Value(4))
  ).current;

  useEffect(() => {
    // metering is typically -160 to 0 dB; normalize to 0..1
    const normalized = Math.max(0, Math.min(1, (metering + 60) / 60));
    bars.forEach((bar, i) => {
      const variation = Math.random() * 0.4 + 0.6;
      const height = Math.max(4, normalized * 40 * variation);
      Animated.timing(bar, {
        toValue: height,
        duration: 100,
        useNativeDriver: false,
      }).start();
    });
  }, [metering, bars]);

  return (
    <View style={waveStyles.container}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            waveStyles.bar,
            { height: bar },
          ]}
        />
      ))}
    </View>
  );
}

const waveStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    gap: 3,
    marginVertical: spacing.sm,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});

// ---------------------------------------------------------------------------
// Voice Recorder Section
// ---------------------------------------------------------------------------

function VoiceRecorder({ onQuoteCreated }: { onQuoteCreated: (id: string) => void }) {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [metering, setMetering] = useState(-160);
  const [statusMessage, setStatusMessage] = useState("");
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const startRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Microphone access is needed to record audio.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && status.metering != null) {
          setMetering(status.metering);
        }
      });
      await recording.startAsync();

      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      setElapsed(0);
      setState("recording");

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err: any) {
      Alert.alert("Recording Error", err?.message || "Could not start recording.");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        Alert.alert("Error", "No recording file found.");
        setState("idle");
        return;
      }

      setState("processing");

      setStatusMessage("Uploading audio...");
      const { url: audioUrl } = await uploadAudio(uri);

      setStatusMessage("Transcribing...");
      await new Promise((r) => setTimeout(r, 500)); // brief visual pause

      setStatusMessage("Generating quote...");
      const result = await (trpc as any).portal.quotes.processVoiceRecording.mutate({
        audioUrl,
        durationSeconds,
      });

      setState("done");
      setStatusMessage("Quote created!");

      setTimeout(() => {
        setState("idle");
        setElapsed(0);
        setMetering(-160);
        setStatusMessage("");
        if (result?.id) {
          onQuoteCreated(result.id);
        }
      }, 800);
    } catch (err: any) {
      Alert.alert("Processing Error", err?.message || "Failed to process recording.");
      setState("idle");
      setElapsed(0);
      setMetering(-160);
      setStatusMessage("");
    }
  }, [onQuoteCreated]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const isRecording = state === "recording";
  const isProcessing = state === "processing";

  return (
    <Card style={recorderStyles.card}>
      <Text style={recorderStyles.title}>Voice-to-Quote</Text>
      <Text style={recorderStyles.subtitle}>
        Describe the job and we'll generate a quote
      </Text>

      {/* Timer */}
      <Text style={recorderStyles.timer}>
        {isRecording || isProcessing ? formatTimer(elapsed) : "00:00"}
      </Text>

      {/* Waveform */}
      {isRecording && <WaveformVisualizer metering={metering} />}

      {/* Record Button */}
      <TouchableOpacity
        onPress={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        activeOpacity={0.7}
        style={[
          recorderStyles.recordButton,
          {
            backgroundColor: isRecording ? colors.primary : isProcessing ? colors.surface : colors.surface,
            borderColor: isRecording ? colors.primary : colors.border,
          },
        ]}
      >
        {isProcessing ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <View
            style={[
              recorderStyles.recordDot,
              {
                backgroundColor: isRecording ? colors.background : colors.primary,
                borderRadius: isRecording ? 4 : 28,
                width: isRecording ? 24 : 28,
                height: isRecording ? 24 : 28,
              },
            ]}
          />
        )}
      </TouchableOpacity>

      <Text style={recorderStyles.hint}>
        {isRecording
          ? "Tap to stop"
          : isProcessing
            ? statusMessage
            : state === "done"
              ? statusMessage
              : "Tap to record"}
      </Text>
    </Card>
  );
}

const recorderStyles = StyleSheet.create({
  card: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.titleBold,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  timer: {
    fontFamily: fonts.titleBold,
    fontSize: 36,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.md,
  },
  recordDot: {
    // dynamic styles applied inline
  },
  hint: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
  },
});

// ---------------------------------------------------------------------------
// Quote Row
// ---------------------------------------------------------------------------

function QuoteRow({ item, onPress }: { item: Quote; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.quoteCard}>
      <View style={styles.quoteHeader}>
        <Badge label={item.status} color={statusBadgeColor(item.status)} />
        <Text style={styles.quoteDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.quoteTitle} numberOfLines={1}>
        {item.title || item.jobTitle || "Untitled Quote"}
      </Text>
      {item.customerName ? (
        <Text style={styles.quoteCustomer} numberOfLines={1}>
          {item.customerName}
        </Text>
      ) : null}
      <Text style={styles.quoteTotal}>{formatCurrency(item.totalAmount)}</Text>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Quotes Screen
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 50;

export default function QuotesScreen() {
  const router = useRouter();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  // ---- Fetch quotes ----
  const fetchQuotes = useCallback(
    async (offset: number, append: boolean) => {
      try {
        const result = await (trpc as any).portal.quotes.list.query({
          limit: PAGE_LIMIT,
          offset,
        });
        const items: Quote[] = Array.isArray(result)
          ? result
          : result?.items ?? result?.quotes ?? [];
        if (append) {
          setQuotes((prev) => [...prev, ...items]);
        } else {
          setQuotes(items);
        }
        setHasMore(items.length >= PAGE_LIMIT);
        offsetRef.current = offset + items.length;
      } catch {
        if (!append) setQuotes([]);
      }
    },
    []
  );

  // ---- Initial load ----
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    offsetRef.current = 0;
    fetchQuotes(0, false).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchQuotes]);

  // ---- Pull to refresh ----
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    offsetRef.current = 0;
    await fetchQuotes(0, false);
    setIsRefreshing(false);
  }, [fetchQuotes]);

  // ---- Load more ----
  const onEndReached = useCallback(async () => {
    if (isLoadingMore || !hasMore || isLoading) return;
    setIsLoadingMore(true);
    await fetchQuotes(offsetRef.current, true);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, isLoading, fetchQuotes]);

  // ---- Navigate ----
  const handlePress = useCallback(
    (quote: Quote) => {
      router.push({
        pathname: "/(portal)/quotes/[id]",
        params: { id: quote.id },
      });
    },
    [router]
  );

  const handleQuoteCreated = useCallback(
    (id: string) => {
      router.push({
        pathname: "/(portal)/quotes/[id]",
        params: { id },
      });
    },
    [router]
  );

  // ---- Render ----
  const renderItem = useCallback(
    ({ item }: { item: Quote }) => (
      <QuoteRow item={item} onPress={() => handlePress(item)} />
    ),
    [handlePress]
  );

  const keyExtractor = useCallback((item: Quote) => item.id, []);

  const ListHeader = useCallback(
    () => (
      <View>
        <VoiceRecorder onQuoteCreated={handleQuoteCreated} />
        <SectionHeader title="Your Quotes" />
      </View>
    ),
    [handleQuoteCreated]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quotes</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={quotes}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={ListHeader}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="No quotes yet"
              subtitle="Record a voice memo or create your first quote to get started."
            />
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            ) : null
          }
        />
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  quoteCard: {
    marginBottom: spacing.sm,
  },
  quoteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  quoteTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  quoteCustomer: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  quoteTotal: {
    fontFamily: fonts.titleSemiBold,
    fontSize: 16,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  quoteDate: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
});
