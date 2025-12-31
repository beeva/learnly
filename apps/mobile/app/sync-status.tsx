import { Alert, View } from "react-native";
import { router } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { announce } from "../src/a11y/announce";
import { Button, IconButton } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Chip } from "../src/components/Chip";
import { Icon } from "../src/components/Icon";
import { EmptyState, SkeletonCard, Text } from "../src/components/primitives";
import { SyncStatusCard } from "../src/components/SyncStatusCard";
import { formatRelative, useCopy } from "../src/i18n";
import { useDeadLetters } from "../src/sync/hardening";
import { discardDeadLetter, retryDeadLetter, type DeadLetter } from "../src/sync/outbox";
import { syncEngine } from "../src/sync";
import { useTheme } from "../src/theme/ThemeProvider";

const copy = {
  title: "Sync & offline data",
  back: "Back",
  needsAttention: "Needs a look",
  needsAttentionHint: "These changes couldn't be uploaded automatically. Nothing has been thrown away.",
  allGood: "Everything's synced",
  allGoodBody: "Every answer and lesson you finished is safely on our servers.",
  "type.attempt.create": "Practice answer",
  "type.lesson.complete": "Finished lesson",
  "type.preferences.update": "Settings change",
  "reason.expired": "Waited more than 30 days to upload",
  "reason.retry_budget_exhausted": "Couldn't upload after several tries",
  "reason.invalid_local_operation": "Saved in an older format",
  "reason.other": "The server couldn't accept it",
  created: "From {when}",
  retry: "Try again",
  discard: "Remove",
  discardTitle: "Remove this change?",
  discardBody: "It won't count toward your progress. This can't be undone.",
  cancel: "Keep it",
  retried: "Queued to upload again",
  removed: "Removed",
};

type Key = keyof typeof copy;

export default function SyncStatusScreen() {
  const t = useCopy("syncStatus", copy);
  const { colors, spacing } = useTheme();
  const deadLetters = useDeadLetters();
  const items = deadLetters.data ?? [];

  const retry = async (item: DeadLetter) => {
    await retryDeadLetter(item.opId);
    announce(t("retried"));
    syncEngine.requestSync(0);
  };

  const discard = (item: DeadLetter) =>
    Alert.alert(t("discardTitle"), t("discardBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("discard"),
        style: "destructive",
        onPress: () => void discardDeadLetter(item.opId).then(() => announce(t("removed"))),
      },
    ]);

  const reasonLabel = (reason: string) => {
    const key = `reason.${reason}` as Key;
    return key in copy ? t(key) : t("reason.other");
  };

  const header = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <IconButton icon="arrowLeft" label={t("back")} onPress={() => router.back()} />
        <Text variant="title" style={{ flex: 1 }}>
          {t("title")}
        </Text>
      </View>
      <SyncStatusCard />
      {items.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="heading">{t("needsAttention")}</Text>
          <Text variant="caption" tone="muted">
            {t("needsAttentionHint")}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <FlashList
        data={items}
        keyExtractor={(item) => item.opId}
        estimatedItemSize={132}
        contentContainerStyle={{ padding: spacing.xl }}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          deadLetters.isLoading ? (
            <SkeletonCard />
          ) : (
            <EmptyState
              icon={<Icon name="check" size={40} color={colors.successText} />}
              title={t("allGood")}
              body={t("allGoodBody")}
            />
          )
        }
        renderItem={({ item }) => (
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
              <Text variant="subheading" style={{ flex: 1 }}>
                {t(`type.${item.type}` as Key)}
              </Text>
              <Chip label={reasonLabel(item.reason)} tone="warning" />
            </View>
            <Text variant="caption" tone="muted">
              {t("created", { when: formatRelative(item.createdAt) })}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button label={t("retry")} icon="refresh" size="sm" fullWidth={false} onPress={() => void retry(item)} />
              <Button label={t("discard")} icon="trash" size="sm" variant="ghost" fullWidth={false} onPress={() => discard(item)} />
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
