import { View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { plural, useCopy } from "../i18n";
import { useIsOnline, useSyncState } from "../sync";
import { useTheme } from "../theme/ThemeProvider";
import { Icon } from "./Icon";
import { Text } from "./primitives";

const copy = {
  offlineTitle: "You're offline",
  offlineBody: "Keep learning — your progress is saved on this device.",
  waitingOne: "{count} answer waiting to sync",
  waitingOther: "{count} answers waiting to sync",
  syncing: "Syncing your progress…",
};

/**
 * A calm, non-blocking banner. Being offline is normal (buses, basements,
 * school wifi), so the tone reassures rather than warns.
 */
export function OfflineBanner() {
  const t = useCopy("offline", copy);
  const online = useIsOnline();
  const sync = useSyncState();
  const { colors, radii, spacing, reducedMotion } = useTheme();
  const syncing = online && sync.status === "syncing" && sync.pending > 0;
  if (online && !syncing) return null;

  const pending = sync.pending;
  const title = online ? t("syncing") : t("offlineTitle");
  const detail = online
    ? null
    : pending > 0
      ? t(plural(pending, "waitingOne", "waitingOther") as "waitingOne" | "waitingOther", { count: pending })
      : t("offlineBody");

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(200)}
      exiting={reducedMotion ? undefined : FadeOut.duration(200)}
      layout={reducedMotion ? undefined : LinearTransition}
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={[title, detail].filter(Boolean).join(". ")}
      testID="offline-banner"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.md,
          backgroundColor: online ? colors.primarySoft : colors.warningSoft,
        }}
      >
        <Icon name={online ? "refresh" : "cloudOff"} size={18} color={online ? colors.primaryText : colors.warningText} />
        <View style={{ flex: 1 }}>
          <Text variant="label" tone={online ? "primary" : "warning"}>
            {title}
          </Text>
          {detail ? (
            <Text variant="caption" tone={online ? "primary" : "warning"}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}
