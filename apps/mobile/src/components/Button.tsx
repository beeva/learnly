import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { Icon, type IconName } from "./Icon";
import { Text } from "./primitives";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "md" | "lg" | "sm";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: "leading" | "trailing";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Light tap on press; off for destructive or very frequent actions. */
  haptic?: boolean;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 40, md: 48, lg: 56 };

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "leading",
  loading = false,
  disabled = false,
  fullWidth = true,
  haptic = true,
  accessibilityHint,
  accessibilityLabel,
  testID,
  style,
}: ButtonProps) {
  const { colors, radii, spacing, reducedMotion, motion } = useTheme();
  const scale = useSharedValue(1);
  const inactive = disabled || loading;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string; pressed: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary, pressed: colors.primaryPressed },
    secondary: { bg: colors.surface, fg: colors.primaryText, border: colors.borderStrong, pressed: colors.primarySoft },
    ghost: { bg: "transparent", fg: colors.primaryText, border: "transparent", pressed: colors.primarySoft },
    danger: { bg: colors.dangerSoft, fg: colors.dangerText, border: colors.dangerSoft, pressed: colors.dangerSoft },
    success: { bg: colors.success, fg: "#0B2E1E", border: colors.success, pressed: colors.successText },
  };
  const tone = palette[variant];

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const pressIn = () => {
    if (reducedMotion) return;
    scale.value = withSpring(0.97, motion.spring);
  };
  const pressOut = () => {
    scale.value = reducedMotion ? 1 : withTiming(1, { duration: motion.duration.fast });
  };
  const press = () => {
    if (inactive || !onPress) return;
    if (haptic) void Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };

  const iconNode = icon ? <Icon name={icon} size={size === "sm" ? 18 : 20} color={tone.fg} /> : null;

  return (
    <Animated.View style={[{ alignSelf: fullWidth ? "stretch" : "flex-start" }, style, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={press}
        onPressIn={pressIn}
        onPressOut={pressOut}
        hitSlop={size === "sm" ? 6 : 0}
        testID={testID}
        style={({ pressed }) => [
          styles.base,
          {
            minHeight: HEIGHT[size],
            borderRadius: radii.md,
            paddingHorizontal: size === "sm" ? spacing.md : spacing.xl,
            backgroundColor: pressed ? tone.pressed : tone.bg,
            borderColor: tone.border,
            borderWidth: variant === "secondary" ? 1.5 : 0,
            opacity: disabled ? 0.5 : 1,
          },
          variant === "primary" && !disabled ? { shadowColor: colors.primary, ...styles.glow } : null,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={tone.fg} />
        ) : (
          <View style={styles.content}>
            {iconPosition === "leading" ? iconNode : null}
            <Text variant={size === "sm" ? "label" : "bodyStrong"} style={{ color: tone.fg }} numberOfLines={2} align="center">
              {label}
            </Text>
            {iconPosition === "trailing" ? iconNode : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Round icon-only button with a required accessible label. */
export function IconButton({
  icon,
  label,
  onPress,
  size = 44,
  tone = "default",
  disabled,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  tone?: "default" | "primary" | "muted";
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const fg = tone === "primary" ? colors.primaryText : tone === "muted" ? colors.textMuted : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      testID={testID}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.surfaceSunken : colors.surfaceMuted,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Icon name={icon} size={Math.round(size * 0.48)} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
  glow: { shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
});
