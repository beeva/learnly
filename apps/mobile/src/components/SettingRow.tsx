import type { ReactNode } from "react";
import { Pressable, Switch, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { a11y } from "../theme/tokens";
import { IconButton } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Text } from "./primitives";

/** Grouped settings card with a small uppercase title, iOS-settings style. */
export function SettingsGroup({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" tone="muted" accessibilityRole="header" style={{ marginLeft: spacing.xs }}>
        {title.toUpperCase()}
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
      {footer ? (
        <Text variant="caption" tone="subtle" style={{ marginHorizontal: spacing.xs }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

interface RowBaseProps {
  icon?: IconName;
  label: string;
  description?: string;
  last?: boolean;
}

function RowShell({ icon, label, description, last, children }: RowBaseProps & { children?: ReactNode }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: a11y.minTouchTarget + 8,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={18} color={colors.primaryText} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" maxFontSizeMultiplier={a11y.maxFontSizeMultiplier}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function SwitchRow({
  value,
  onValueChange,
  disabled,
  ...row
}: RowBaseProps & { value: boolean; onValueChange: (next: boolean) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={row.label}
      accessibilityHint={row.description}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
    >
      <RowShell {...row}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={colors.borderStrong}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </RowShell>
    </Pressable>
  );
}

/**
 * A value with − / + buttons. Screen readers get a single "adjustable" element
 * that responds to swipe up / down, which is far easier than two tiny buttons.
 */
export function StepperRow({
  value,
  display,
  onChange,
  min,
  max,
  step,
  decreaseLabel,
  increaseLabel,
  ...row
}: RowBaseProps & {
  value: number;
  display: string;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  const { spacing } = useTheme();
  const clampTo = (n: number) => Math.min(max, Math.max(min, n));
  const decrease = () => onChange(clampTo(value - step));
  const increase = () => onChange(clampTo(value + step));
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={row.label}
      accessibilityHint={row.description}
      accessibilityValue={{ text: display }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "increment") increase();
        if (e.nativeEvent.actionName === "decrement") decrease();
      }}
    >
      <RowShell {...row}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <IconButton icon="minus" label={decreaseLabel} size={36} onPress={decrease} disabled={value <= min} />
          <Text variant="bodyStrong" style={{ minWidth: 72, textAlign: "center" }} maxFontSizeMultiplier={1.6}>
            {display}
          </Text>
          <IconButton icon="plus" label={increaseLabel} size={36} onPress={increase} disabled={value >= max} />
        </View>
      </RowShell>
    </View>
  );
}

export function LinkRow({ onPress, value, ...row }: RowBaseProps & { onPress: () => void; value?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${row.label}, ${value}` : row.label}
      accessibilityHint={row.description}
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceMuted : "transparent" })}
    >
      <RowShell {...row}>
        {value ? (
          <Text variant="callout" tone="muted">
            {value}
          </Text>
        ) : null}
        <Icon name="chevronRight" size={18} color={colors.textSubtle} />
      </RowShell>
    </Pressable>
  );
}

export function RadioRow({ selected, onPress, ...row }: RowBaseProps & { selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={row.label}
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceMuted : "transparent" })}
    >
      <RowShell {...row}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? colors.primary : colors.borderStrong,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
        </View>
      </RowShell>
    </Pressable>
  );
}

/** "18:30" style minutes-after-midnight helpers for time steppers. */
export function minutesToDate(minutes: number, base = new Date()): Date {
  const d = new Date(base);
  d.setHours(Math.floor(minutes / 60) % 24, minutes % 60, 0, 0);
  return d;
}
