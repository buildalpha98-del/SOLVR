import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../../lib/trpc";
import { colors, fonts, spacing, borderRadius } from "../../../lib/theme";
import { Card, Badge, EmptyState, Input, Skeleton } from "../../../components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Call {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------

function CallsSkeleton() {
  return (
    <View style={{ padding: spacing.md }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton width={70} height={20} />
          <Skeleton width="80%" height={16} style={{ marginTop: spacing.sm }} />
          <Skeleton width="60%" height={14} style={{ marginTop: spacing.xs }} />
          <Skeleton width={50} height={12} style={{ marginTop: spacing.xs }} />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Call Row
// ---------------------------------------------------------------------------

function CallRow({ item, onPress }: { item: Call; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.callCard}>
      <View style={styles.callHeader}>
        <Badge label={item.type} color={callTypeBadgeColor(item.type)} />
        <Text style={styles.callTime}>{formatRelativeDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.callTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.callBody} numberOfLines={1}>
        {item.body}
      </Text>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Calls List Screen
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 50;

export default function CallsScreen() {
  const router = useRouter();

  const [calls, setCalls] = useState<Call[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  // ---- Fetch calls ----
  const fetchCalls = useCallback(
    async (offset: number, searchTerm: string, append: boolean) => {
      try {
        const result = await (trpc as any).portal.listCalls.query({
          search: searchTerm || undefined,
          limit: PAGE_LIMIT,
          offset,
        });
        const items: Call[] = Array.isArray(result) ? result : result?.items ?? result?.calls ?? [];
        if (append) {
          setCalls((prev) => [...prev, ...items]);
        } else {
          setCalls(items);
        }
        setHasMore(items.length >= PAGE_LIMIT);
        offsetRef.current = offset + items.length;
      } catch {
        if (!append) setCalls([]);
      }
    },
    [],
  );

  // ---- Initial load ----
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    offsetRef.current = 0;
    fetchCalls(0, search, false).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [search, fetchCalls]);

  // ---- Pull to refresh ----
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    offsetRef.current = 0;
    await fetchCalls(0, search, false);
    setIsRefreshing(false);
  }, [search, fetchCalls]);

  // ---- Load more (pagination) ----
  const onEndReached = useCallback(async () => {
    if (isLoadingMore || !hasMore || isLoading) return;
    setIsLoadingMore(true);
    await fetchCalls(offsetRef.current, search, true);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, isLoading, search, fetchCalls]);

  // ---- Navigate to detail ----
  const handlePress = useCallback(
    (call: Call) => {
      router.push({
        pathname: "/(portal)/calls/[id]",
        params: {
          id: call.id,
          title: call.title,
          body: call.body,
          type: call.type,
          createdAt: call.createdAt,
        },
      });
    },
    [router],
  );

  // ---- Render ----
  const renderItem = useCallback(
    ({ item }: { item: Call }) => (
      <CallRow item={item} onPress={() => handlePress(item)} />
    ),
    [handlePress],
  );

  const keyExtractor = useCallback((item: Call) => item.id, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calls</Text>
      </View>

      <View style={styles.searchContainer}>
        <Input
          placeholder="Search calls..."
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      {isLoading ? (
        <CallsSkeleton />
      ) : (
        <FlatList
          data={calls}
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
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <EmptyState
              icon="📞"
              title="No calls yet"
              subtitle={
                search
                  ? "No calls match your search. Try a different term."
                  : "When you receive calls, they will appear here."
              }
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
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  callCard: {
    marginBottom: spacing.sm,
  },
  callHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  callTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  callBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  callTime: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
});
