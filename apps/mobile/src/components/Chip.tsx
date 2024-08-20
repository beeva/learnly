import { Pressable, View } from "react-native";
import type { MasteryBand } from "@learnly/shared";
import { useTheme } from "../theme/ThemeProvider";
import { bandColors } from "../theme/tokens";
import { Icon, type IconName } from "./Icon";
import { Text } from "./primitives";

export type ChipTone = "neutral" | "primary" | "success" | "warning" | "accent" | "danger";

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  icon?: IconName;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export function Chip({ label, tone = "neutral", icon, selected, onPress, accessibilityLabel, testID }: ChipProps) {
  const { colors, radii, spacing } = useTheme();
  const tones: Record<ChipTone, { bg: string; fg: string }> = {
    neutral: { bg: colors.surfaceMuted, fg: colors.textMuted },
    primary: { bg: colors.primarySoft, fg: colors.primaryText },
    success: { bg: colors.successSoft, fg: colors.successText },
    warning: { bg: colors.warningSoft, fg: colors.warningText },
    accent: { bg: colors.accentSoft, fg: colors.accentText },
    danger: { bg: colors.dangerSoft, fg: colors.dangerText },
  };
  const t = selected ? { bg: colors.primary, fg: colors.onPrimary } : tones[tone];

  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: onPress ? spacing.sm : spacing.xs + 1,
        borderRadius: radii.pill,
        backgroundColor: t.bg,
        alignSelf: "flex-start",
      }}
    >
      {icon ? <Icon name={icon} size={14} color={t.fg} strokeWidth={2.4} /> : null}
      <Text variant="label" style={{ color: t.fg }} maxFontSizeMultiplier={1.4} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel ?? label} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={6}
      testID={testID}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      {body}
    </Pressable>
  );
}

const BAND_ICON: Record<MasteryBand, IconName> = {
  new: "sparkle",
  learning: "lightbulb",
  practicing: "target",
  mastered: "star",
};

/** Mastery band pill used on skills, units and the diagnostic summary. */
export function BandChip({ band, label }: { band: MasteryBand; label: string }) {
  const { colors, radii, spacing } = useTheme();
  const c = bandColors(band, colors);
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 3,
        borderRadius: radii.pill,
        backgroundColor: c.bg,
        alignSelf: "flex-start",
      }}
    >
      <Icon name={BAND_ICON[band]} size={12} color={c.fg} strokeWidth={2.6} />
      <Text variant="label" style={{ color: c.fg }} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </View>
  );
}
