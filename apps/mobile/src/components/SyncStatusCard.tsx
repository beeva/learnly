import { useEffect, useState } from "react";
import { View } from "react-native";
import { formatRelative, plural, useCopy } from "../i18n";
import { syncEngine, useIsOnline, useSyncState } from "../sync";
import type { SyncStatus } from "../sync/engine";
import { useTheme } from "../theme/ThemeProvider";
import { Button } from "./Button";
import { Card } from "./Card";
import { Icon, type IconName } from "./Icon";
import { Text } from "./primitives";

const copy = {
  idle: "All caught up",
  syncing: "Syncing now…",
  offline: "Waiting for a connection",
  backoff: "Taking a short breather",
  error: "Sync paused",
  pendingOne: "{count} change waiting to upload",
  pendingOther: "{count} changes waiting to upload",
  nothingPending: "Nothing waiting to upload",
  lastSynced: "Last synced {when}",
  neverSynced: "Not synced on this device yet",
  retryIn: "Trying again in {seconds}s",
  errorHint: "Sign in again to resume syncing. Your answers are safe on this device.",
  syncNow: "Sync now",
};

const STATUS: Record<SyncStatus, { icon: IconName; tone: "success" | "primary" | "warning" | "danger" }> = {
  idle: { icon: "check", tone: "success" },
  syncing: { icon: "refresh", tone: "primary" },
  offline: { icon: "cloudOff", tone: "warning" },
  backoff: { icon: "clock", tone: "warning" },
  error: { icon: "alert", tone: "danger" },
};

/** Live sync health: status, pending count, last sync and a manual retry. */
export function SyncStatusCard() {
  const t = useCopy("sync", copy);
  const state = useSyncState();
  const online = useIsOnline();
  const { colors, spacing } = useTheme();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (state.nextRetryAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.nextRetryAt]);

  const meta = STATUS[state.status];
  const fg = {
    success: colors.successText,
    primary: colors.primaryText,
    warning: colors.warningText,
    danger: colors.dangerText,
  }[meta.tone];
  const bg = {
    success: colors.successSoft,
    primary: colors.primarySoft,
    warning: colors.warningSoft,
    danger: colors.dangerSoft,
  }[meta.tone];
  const seconds = state.nextRetryAt ? Math.max(0, Math.ceil((state.nextRetryAt - now) / 1000)) : null;
  const pendingText =
    state.pending > 0
      ? t(plural(state.pending, "pendingOne", "pendingOther") as "pendingOne" | "pendingOther", { count: state.pending })
      : t("nothingPending");

  return (
    <Card style={{ gap: spacing.lg }} accessibilityLabel={`${t(state.status)}. ${pendingText}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name={meta.icon} size={22} color={fg} />
        </View>
        <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
          <Text variant="subheading">{t(state.status)}</Text>
          <Text variant="caption" tone="muted">
            {pendingText}
          </Text>
        </View>
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" tone="subtle">
          {state.lastSyncedAt ? t("lastSynced", { when: formatRelative(state.lastSyncedAt, now) }) : t("neverSynced")}
        </Text>
        {seconds !== null && state.status === "backoff" ? (
          <Text variant="caption" tone="warning">
            {t("retryIn", { seconds })}
          </Text>
        ) : null}
        {state.status === "error" ? (
          <Text variant="caption" tone="danger">
            {t("errorHint")}
          </Text>
        ) : null}
      </View>
      <Button
        label={t("syncNow")}
        icon="refresh"
        variant="secondary"
        disabled={!online || state.status === "syncing"}
        loading={state.status === "syncing"}
        onPress={() => syncEngine.handleReconnect()}
        testID="sync-now"
      />
    </Card>
  );
}
