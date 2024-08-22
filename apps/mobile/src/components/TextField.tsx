import { forwardRef, useState } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { Icon } from "./Icon";
import { Text } from "./primitives";

export interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Shows a show/hide toggle for passwords. */
  secure?: boolean;
  suffix?: string;
  large?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, secure, suffix, large, onFocus, onBlur, editable = true, ...input },
  ref,
) {
  const { colors, radii, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.borderStrong;
  const describedBy = [hint, error].filter(Boolean).join(". ");

  return (
    <View style={{ gap: spacing.xs + 2 }}>
      <Text variant="label" tone="muted" nativeID={`${label}-label`}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: large ? 64 : 52,
          borderRadius: radii.md,
          borderWidth: focused || error ? 2 : 1.5,
          borderColor,
          backgroundColor: editable ? colors.surface : colors.surfaceMuted,
          paddingHorizontal: spacing.lg - (focused || error ? 0.5 : 0),
        }}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={describedBy || undefined}
          accessibilityLabelledBy={`${label}-label`}
          accessibilityState={{ disabled: !editable }}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          secureTextEntry={secure ? hidden : false}
          editable={editable}
          maxFontSizeMultiplier={2}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            large ? typography.heading : typography.body,
            { flex: 1, color: colors.text, paddingVertical: spacing.sm },
          ]}
          {...input}
        />
        {suffix ? (
          <Text tone="muted" variant="callout" style={{ marginLeft: spacing.sm }}>
            {suffix}
          </Text>
        ) : null}
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            hitSlop={10}
            style={{ marginLeft: spacing.sm }}
          >
            <Icon name={hidden ? "eye" : "eyeOff"} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }} accessibilityLiveRegion="polite">
          <Icon name="alert" size={14} color={colors.dangerText} />
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
