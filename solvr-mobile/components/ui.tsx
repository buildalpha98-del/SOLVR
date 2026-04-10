import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
  RefreshControl,
  ScrollView,
} from "react-native";
import { colors, fonts, spacing, borderRadius } from "../lib/theme";

// ─── Button ───────────────────────────────────────────────────────
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
}: ButtonProps) {
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
        ? colors.danger
        : variant === "secondary"
          ? colors.surface
          : "transparent";

  const textColor =
    variant === "primary" ? colors.background : colors.textPrimary;
  const borderColor =
    variant === "secondary" ? colors.border : variant === "ghost" ? "transparent" : "transparent";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === "secondary" ? 1 : 0,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: textColor, fontFamily: fonts.bodySemiBold },
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Input ────────────────────────────────────────────────────────
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  containerStyle,
  style,
  ...props
}: InputProps) {
  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          error ? { borderColor: colors.danger } : {},
          style as TextStyle,
        ]}
        {...props}
      />
      {error && <Text style={styles.inputError}>{error}</Text>}
    </View>
  );
}

// ─── Card ─────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.card, style]}
    >
      {children}
    </Wrapper>
  );
}

// ─── Section Header ───────────────────────────────────────────────
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={styles.sectionAction}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: string;
  title: string;
  subtitle: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {action && (
        <Button
          title={action.label}
          onPress={action.onPress}
          style={{ marginTop: spacing.md }}
        />
      )}
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────
export function Skeleton({
  width,
  height = 16,
  style,
}: {
  width: number | string;
  height?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          width: width as number,
          height,
          backgroundColor: colors.border,
          borderRadius: borderRadius.sm,
        },
        style,
      ]}
    />
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────
export function KPICard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, color ? { color } : {}]}>
        {value}
      </Text>
    </View>
  );
}

// ─── PullToRefreshScrollView ──────────────────────────────────────
export function PullRefreshScroll({
  children,
  onRefresh,
  refreshing,
  style,
}: {
  children: React.ReactNode;
  onRefresh: () => void;
  refreshing: boolean;
  style?: ViewStyle;
}) {
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {children}
    </ScrollView>
  );
}

// ─── Badge ────────────────────────────────────────────────────────
export function Badge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <View
      style={[styles.badge, { backgroundColor: color + "20", borderColor: color }]}
    >
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonText: {
    fontSize: 16,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: fonts.bodyRegular,
  },
  inputError: {
    color: colors.danger,
    fontSize: 12,
    marginTop: spacing.xs,
    fontFamily: fonts.bodyRegular,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: fonts.titleSemiBold,
  },
  sectionAction: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontFamily: fonts.titleSemiBold,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
    textAlign: "center",
  },
  kpiCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flex: 1,
    marginHorizontal: 4,
  },
  kpiLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    marginBottom: spacing.xs,
  },
  kpiValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontFamily: fonts.titleBold,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
  },
});
