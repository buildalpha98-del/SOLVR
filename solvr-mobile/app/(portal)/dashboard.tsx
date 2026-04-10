import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
} from "react-native";
import { useAuth } from "../../lib/auth";
import { trpc } from "../../lib/trpc";
import {
  colors,
  fonts,
  spacing,
  borderRadius,
  LOGO_URL,
} from "../../lib/theme";
import { Card, KPICard, Skeleton, PullRefreshScroll, Badge } from "../../components/ui";

interface CallVolume {
  date: string;
  count: number;
}

interface RecentCall {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
}

interface DashboardData {
  totalCalls: number;
  callsThisMonth: number;
  activeJobs: number;
  wonJobs: number;
  wonRevenue: number;
  pipelineRevenue: number;
  callVolumeByDay: CallVolume[];
  recentCalls: RecentCall[];
  features: string[];
}

interface WeeklyInsightData {
  insight: string;
  generatedAt: string;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

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
    case "inbound":
      return colors.success;
    case "outbound":
      return colors.primary;
    case "missed":
      return colors.danger;
    default:
      return colors.textSecondary;
  }
}

function CallVolumeChart({ data }: { data: CallVolume[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const BAR_MAX_HEIGHT = 100;

  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.title}>Call Volume (7 days)</Text>
      <View style={chartStyles.barsRow}>
        {data.slice(-7).map((day) => {
          const height = Math.max((day.count / maxCount) * BAR_MAX_HEIGHT, 4);
          const label = new Date(day.date).toLocaleDateString("en-US", {
            weekday: "short",
          });
          return (
            <View key={day.date} style={chartStyles.barWrapper}>
              <Text style={chartStyles.barCount}>{day.count}</Text>
              <View
                style={[
                  chartStyles.bar,
                  { height, backgroundColor: colors.primary },
                ]}
              />
              <Text style={chartStyles.barLabel}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.titleSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  barsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 140,
    paddingTop: spacing.sm,
  },
  barWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    width: 24,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
  barCount: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  barLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 10,
    color: colors.textSecondary,
  },
});

function DashboardSkeleton() {
  return (
    <View style={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Skeleton width={180} height={20} />
          <Skeleton width={120} height={14} style={{ marginTop: spacing.xs }} />
        </View>
        <Skeleton width={36} height={36} style={{ borderRadius: 18 }} />
      </View>
      <View style={styles.kpiGrid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.kpiCell}>
            <Skeleton width="100%" height={80} style={{ borderRadius: borderRadius.lg }} />
          </View>
        ))}
      </View>
      <Skeleton
        width="100%"
        height={180}
        style={{ borderRadius: borderRadius.lg, marginBottom: spacing.md }}
      />
      <Skeleton width={140} height={18} style={{ marginBottom: spacing.sm }} />
      {[1, 2, 3].map((i) => (
        <Skeleton
          key={i}
          width="100%"
          height={72}
          style={{ borderRadius: borderRadius.md, marginBottom: spacing.sm }}
        />
      ))}
    </View>
  );
}

export default function DashboardScreen() {
  const { user, hasFeature } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [insight, setInsight] = useState<WeeklyInsightData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsError(false);
      const data = await (trpc as any).portal.getDashboard.query();
      setDashboard(data);

      if (hasFeature("ai-insights")) {
        try {
          const insightData = await (trpc as any).portal.getWeeklyInsight.query();
          setInsight(insightData);
        } catch {
          // insight is optional
        }
      }
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [hasFeature]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (isError && !dashboard) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Failed to load dashboard. Pull down to retry.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <PullRefreshScroll onRefresh={onRefresh} refreshing={refreshing}>
        {isLoading ? (
          <DashboardSkeleton />
        ) : dashboard ? (
          <View style={styles.content}>
            <View style={styles.headerRow}>
              <View style={styles.headerTextBlock}>
                <Text style={styles.welcomeLabel}>Welcome back,</Text>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.name ?? "there"}
                </Text>
              </View>
              <Image
                source={{ uri: LOGO_URL }}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.kpiGrid}>
              <View style={styles.kpiCell}>
                <KPICard
                  label="Total Calls"
                  value={dashboard.totalCalls.toLocaleString()}
                />
              </View>
              <View style={styles.kpiCell}>
                <KPICard
                  label="This Month"
                  value={dashboard.callsThisMonth.toLocaleString()}
                />
              </View>
              <View style={styles.kpiCell}>
                <KPICard
                  label="Active Jobs"
                  value={dashboard.activeJobs.toLocaleString()}
                />
              </View>
              <View style={styles.kpiCell}>
                <KPICard
                  label="Won Revenue"
                  value={formatCurrency(dashboard.wonRevenue)}
                  color={colors.success}
                />
              </View>
            </View>

            {dashboard.callVolumeByDay.length > 0 && (
              <CallVolumeChart data={dashboard.callVolumeByDay} />
            )}

            {hasFeature("ai-insights") && insight && (
              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <Text style={styles.insightTitle}>Weekly AI Insight</Text>
                  <Badge label="AI" color={colors.primary} />
                </View>
                <Text style={styles.insightBody}>{insight.insight}</Text>
                <Text style={styles.insightMeta}>
                  Generated{" "}
                  {new Date(insight.generatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Recent Calls</Text>
            {dashboard.recentCalls.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No recent calls yet.</Text>
              </View>
            ) : (
              dashboard.recentCalls.map((call) => (
                <Card key={call.id} style={styles.callCard}>
                  <View style={styles.callCardHeader}>
                    <Text style={styles.callTitle} numberOfLines={1}>
                      {call.title}
                    </Text>
                    <Badge
                      label={call.type}
                      color={callTypeBadgeColor(call.type)}
                    />
                  </View>
                  <Text style={styles.callBody} numberOfLines={2}>
                    {call.body}
                  </Text>
                  <Text style={styles.callTime}>
                    {formatRelativeDate(call.createdAt)}
                  </Text>
                </Card>
              ))
            )}
          </View>
        ) : null}
      </PullRefreshScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  headerTextBlock: {
    flex: 1,
    marginRight: spacing.md,
  },
  welcomeLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  userName: {
    fontFamily: fonts.titleBold,
    fontSize: 22,
    color: colors.textPrimary,
    marginTop: 2,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.md,
  },
  kpiCell: {
    width: "50%",
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  insightCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  insightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  insightTitle: {
    fontFamily: fonts.titleSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  insightBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  insightMeta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: fonts.titleSemiBold,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  callCard: {
    marginBottom: spacing.sm,
  },
  callCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  callTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  callBody: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  callTime: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.danger,
    textAlign: "center",
  },
});
