import { forwardRef, useEffect, type ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import type { ColorTokens, TypographyVariant } from "../theme/tokens";

type Tone = "default" | "muted" | "subtle" | "primary" | "success" | "warning" | "danger" | "accent" | "inverse";

function toneColor(tone: Tone, colors: ColorTokens): string {
  switch (tone) {
    case "muted":
      return colors.textMuted;
    case "subtle":
      return colors.textSubtle;
    case "primary":
      return colors.primaryText;
    case "success":
      return colors.successText;
    case "warning":
      return colors.warningText;
    case "danger":
      return colors.dangerText;
    case "accent":
      return colors.accentText;
    case "inverse":
      return colors.onPrimary;
    default:
      return colors.text;
  }
}

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  align?: TextStyle["textAlign"];
  children?: ReactNode;
}

/**
 * Text with the brand type scale. Scales with the OS text size (Dynamic Type /
 * font scale) up to 2x, which keeps layouts intact while honouring large text.
 */
export const Text = forwardRef<RNText, TextProps>(function Text(
  { variant = "body", tone = "default", align, style, ...rest },
  ref,
) {
  const { colors, typography } = useTheme();
  const isHeading = variant === "display" || variant === "title" || variant === "heading";
  return (
    <RNText
      ref={ref}
      accessibilityRole={isHeading ? "header" : rest.accessibilityRole}
      maxFontSizeMultiplier={2}
      {...rest}
      style={[typography[variant], { color: toneColor(tone, colors), textAlign: align }, style]}
    />
  );
});

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Page shell: safe areas, paper background, comfortable gutters and pull to refresh. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ["top", "left", "right"],
  refreshing,
  onRefresh,
  footer,
  contentStyle,
  testID,
}: ScreenProps) {
  const { colors, spacing } = useTheme();
  const padding = padded ? { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg } : null;
  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: colors.background }]} testID={testID}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, { paddingBottom: spacing.xxxl, gap: spacing.lg }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing ?? false}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, padding, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View
          style={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: spacing.lg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export function Row({
  children,
  gap = 8,
  align = "center",
  justify = "flex-start",
  wrap = false,
  style,
}: {
  children: ReactNode;
  gap?: number;
  align?: ViewStyle["alignItems"];
  justify?: ViewStyle["justifyContent"];
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: align, justifyContent: justify, gap, flexWrap: wrap ? "wrap" : "nowrap" },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface SkeletonProps {
  width?: ViewStyle["width"];
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Calm, slow pulse while content loads. Holds still when reduced motion is on. */
export function Skeleton({ width = "100%", height = 16, radius, style }: SkeletonProps) {
  const { colors, radii, reducedMotion } = useTheme();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 0.7;
      return;
    }
    opacity.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius ?? radii.sm / 1.5, backgroundColor: colors.surfaceSunken },
        animated,
        style,
      ]}
    />
  );
}

export function SkeletonText({ lines = 3, lastLineWidth = "60%" }: { lines?: number; lastLineWidth?: ViewStyle["width"] }) {
  return (
    <View style={{ gap: 10 }} accessibilityLabel="Loading" accessible>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? lastLineWidth : "100%"} height={14} />
      ))}
    </View>
  );
}

export function SkeletonCard({ height = 112 }: { height?: number }) {
  const { radii } = useTheme();
  return <Skeleton height={height} radius={radii.lg} />;
}

/** Friendly empty / error placeholder used by lists and screens. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.md }}>
      {icon}
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text tone="muted" align="center">
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.sm, alignSelf: "stretch" }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
