import { Alert, View } from "react-native";
import { router } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { announce } from "../src/a11y/announce";
import { Button, IconButton } from "../src/components/Button";
import { Card } from "../src/components/Card";
import { Icon } from "../src/components/Icon";
import { EmptyState, SkeletonCard, Text } from "../src/components/primitives";
import { formatNumber, useCopy } from "../src/i18n";
import { lessonRepo, storageStats } from "../src/db/repo";
import { queryKeys, useDownloadedLessons } from "../src/offline/data";
import { useTheme } from "../src/theme/ThemeProvider";

const copy = {
  title: "Downloaded lessons",
  back: "Back",
  summary: "{lessons} lessons · {size} on this device",
  scorable: "{count} practice questions can be checked offline",
  minutes: "{minutes} min",
  open: "Open {title}",
  emptyTitle: "Nothing downloaded yet",
  emptyBody: "Open a course and tap “Download for offline” before a trip or a spotty-wifi day.",
  browse: "Browse courses",
  removeAll: "Remove all downloads",
  removeTitle: "Remove downloaded lessons?",
  removeBody: "Your progress stays. You can download them again any time you're online.",
  cancel: "Cancel",
  remove: "Remove",
  removed: "Downloads removed",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, { maximumFractionDigits: 0 })} KB`;
  return `${formatNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 })} MB`;
}

export default function DownloadsScreen() {
  const t = useCopy("downloads", copy);
  const { colors, spacing } = useTheme();
  const queryClient = useQueryClient();
  const lessons = useDownloadedLessons();
  const stats = useQuery({ queryKey: ["storage-stats"], queryFn: storageStats, networkMode: "always" });

  const removeAll = () =>
    Alert.alert(t("removeTitle"), t("removeBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("remove"),
        style: "destructive",
        onPress: () =>
          void lessonRepo.removeDownloads().then(async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.downloads });
            await queryClient.invalidateQueries({ queryKey: ["storage-stats"] });
            announce(t("removed"));
          }),
      },
    ]);

  const data = lessons.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <FlashList
        data={data}
        keyExtractor={(item) => item.id}
        estimatedItemSize={76}
        contentContainerStyle={{ padding: spacing.xl }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <IconButton icon="arrowLeft" label={t("back")} onPress={() => router.back()} />
              <Text variant="title" style={{ flex: 1 }}>
                {t("title")}
              </Text>
            </View>
            {stats.data && data.length > 0 ? (
              <Card tone="primary" style={{ gap: spacing.xs }}>
                <Text variant="bodyStrong" tone="primary">
                  {t("summary", { lessons: stats.data.downloadedLessons, size: formatBytes(stats.data.approxBytes) })}
                </Text>
                <Text variant="caption" tone="primary">
                  {t("scorable", { count: stats.data.scorableItems })}
                </Text>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          lessons.isLoading ? (
            <SkeletonCard height={72} />
          ) : (
            <EmptyState
              icon={<Icon name="download" size={40} color={colors.primaryText} />}
              title={t("emptyTitle")}
              body={t("emptyBody")}
              action={<Button label={t("browse")} variant="secondary" onPress={() => router.push("/(tabs)/learn")} />}
            />
          )
        }
        ListFooterComponent={
          data.length > 0 ? (
            <View style={{ paddingTop: spacing.xl }}>
              <Button label={t("removeAll")} variant="danger" icon="trash" onPress={removeAll} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({ pathname: "/lesson/[id]", params: { id: item.id, course: item.courseSlug ?? "" } })
            }
            accessibilityLabel={t("open", { title: item.title })}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.successSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="check" size={20} color={colors.successText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" numberOfLines={2}>
                {item.title}
              </Text>
              <Text variant="caption" tone="muted">
                {t("minutes", { minutes: item.estimatedMinutes })}
              </Text>
            </View>
            <Icon name="chevronRight" size={18} color={colors.textSubtle} />
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
