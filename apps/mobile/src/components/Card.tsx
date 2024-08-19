import type { ReactNode } from "react";
import { Pressable, View, type AccessibilityRole, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  /** Soft tinted background, e.g. a success card after a finished lesson. */
  tone?: "default" | "primary" | "success" | "warning" | "accent" | "muted";
  elevated?: boolean;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  testID?: string;
}

/** Rounded surface with a soft shadow. Becomes a single accessible button when pressable. */
export function Card({
  children,
  onPress,
  tone = "default",
  elevated = true,
  padding,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  testID,
}: CardProps) {
  const { colors, radii, spacing, elevation, mode } = useTheme();
  const backgrounds: Record<NonNullable<CardProps["tone"]>, string> = {
    default: colors.surface,
    primary: colors.primarySoft,
    success: colors.successSoft,
    warning: colors.warningSoft,
    accent: colors.accentSoft,
    muted: colors.surfaceMuted,
  };
  const base: ViewStyle = {
    backgroundColor: backgrounds[tone],
    borderRadius: radii.lg,
    padding: padding ?? spacing.lg,
    borderWidth: mode === "dark" || tone === "default" ? 1 : 0,
    borderColor: colors.border,
    ...(elevated && tone === "default" ? { shadowColor: colors.shadow, ...elevation.low } : null),
  };

  if (!onPress) {
    return (
      <View
        style={[base, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessible={accessibilityLabel ? true : undefined}
        testID={testID}
      >
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [base, pressed ? { opacity: 0.92, transform: [{ scale: 0.99 }] } : null, style]}
    >
      {children}
    </Pressable>
  );
}
