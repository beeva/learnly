import { useCallback, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Chip } from "../../src/components/Chip";
import { Icon, type IconName } from "../../src/components/Icon";
import { OfflineBanner } from "../../src/components/OfflineBanner";
import { EmptyState, Row, Screen, SkeletonCard, Text } from "../../src/components/primitives";
import { ProgressRing } from "../../src/components/Progress";
import { plural, useCopy } from "../../src/i18n";
import type { Recommendation, RecommendationType } from "../../src/lib/api";
import { useDownloadedLessons, useProgress, useRecommendations } from "../../src/offline/data";
import { useSession } from "../../src/session/SessionProvider";
import { useTheme } from "../../src/theme/ThemeProvider";
import { brand } from "../../src/theme/tokens";

const copy = {
  morning: "Good morning, {name}",
  afternoon: "Good afternoon, {name}",
  evening: "Good evening, {name}",
  subtitle: "A little every day adds up.",
  goalTitle: "Today's goal",
  goalProgress: "{done} of {goal} minutes",
  goalDone: "Goal reached — nice work!",
  ofGoal: "of {goal} min",
  goalRing: "Daily goal, {done} of {goal} minutes",
  streakOne: "{count} day streak",
  streakOther: "{count} day streak",
  streakStart: "Start a streak today",
  level: "Level {level}",
  xp: "{xp} XP",
  upNext: "Up next",
  minutes: "{n} min",
  type_lesson: "Lesson",
  type_practice: "Practice",
  type_review: "Review",
  type_diagnostic: "Placement check",
  emptyTitle: "You're all caught up",
  emptyBody: "Browse a course to pick what to learn next.",
  browse: "Browse courses",
  errorTitle: "We couldn't load your next steps",
  errorBody: "Check your connection and try again.",
  retry: "Try again",
  offlineReady: "Ready offline",
  openLesson: "Open lesson {title}",
};

const TYPE_ICON: Record<RecommendationType, IconName> = {
  lesson: "book",
  practice: "target",
  review: "refresh",
  diagnostic: "compass",
};

function greetingKey(date = new Date()): "morning" | "afternoon" | "evening" {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function openRecommendation(rec: Recommendation) {
  if (rec.type === "lesson" && rec.lessonId) {
    router.push({ pathname: "/lesson/[id]", params: { id: rec.lessonId, course: rec.courseSlug } });
  } else if (rec.type === "diagnostic") {
    router.push({ pathname: "/diagnostic/[slug]", params: { slug: rec.courseSlug } });
  } else {
    router.push({ pathname: "/practice/[slug]", params: { slug: rec.courseSlug } });
  }
}

export default function HomeScreen() {
  const t = useCopy("home", copy);
  const session = useSession();
  const { colors, spacing, reducedMotion } = useTheme();
  const progress = useProgress(session.progress);
  const recommendations = useRecommendations();
  const downloads = useDownloadedLessons();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        session.refresh().catch(() => undefined),
        progress.refetch(),
        recommendations.refetch(),
        downloads.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [downloads, progress, recommendations, session]);

  const summary = progress.data ?? session.progress;
  const minutesToday = summary?.minutesToday ?? 0;
  const goal = Math.max(1, summary?.dailyGoalMinutes ?? session.preferences.dailyGoalMinutes);
  const goalRatio = minutesToday / goal;
  const streak = summary?.streak.current ?? 0;
  const firstName = session.user?.displayName.split(" ")[0] ?? "";
  const enter = (index: number) => (reducedMotion ? undefined : FadeInDown.delay(index * 70).duration(320));

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()} testID="home-screen">
      <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
        <Text variant="title">{t(greetingKey(), { name: firstName })}</Text>
        <Text tone="muted">{t("subtitle")}</Text>
      </View>

      <OfflineBanner />

      <Animated.View entering={enter(0)}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
          <ProgressRing
            progress={goalRatio}
            size={96}
            strokeWidth={11}
            color={colors.primary}
            colorEnd={brand.coral}
            accessibilityLabel={t("goalRing", { done: minutesToday, goal })}
          >
            <Text variant="heading">{Math.min(minutesToday, 999)}</Text>
            <Text variant="caption" tone="muted">
              {t("ofGoal", { goal })}
            </Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="subheading">{t("goalTitle")}</Text>
            <Text tone="muted" variant="callout">
              {goalRatio >= 1 ? t("goalDone") : t("goalProgress", { done: minutesToday, goal })}
            </Text>
            <Row gap={spacing.sm} wrap style={{ marginTop: spacing.xs }}>
              {summary ? <Chip label={t("level", { level: summary.level.level })} tone="primary" icon="star" /> : null}
              {summary ? <Chip label={t("xp", { xp: summary.totalXp })} tone="neutral" icon="sparkle" /> : null}
            </Row>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <Card
          tone={streak > 0 ? "accent" : "muted"}
          accessibilityLabel={streak > 0 ? t(plural(streak, "streakOne", "streakOther") as "streakOne", { count: streak }) : t("streakStart")}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface,
            }}
          >
            <Icon name="flame" size={26} color={streak > 0 ? brand.coral : colors.textSubtle} />
          </View>
          <Text variant="subheading" tone={streak > 0 ? "accent" : "muted"} style={{ flex: 1 }}>
            {streak > 0
              ? t(plural(streak, "streakOne", "streakOther") as "streakOne", { count: streak })
              : t("streakStart")}
          </Text>
        </Card>
      </Animated.View>

      <Text variant="heading" style={{ marginTop: spacing.sm }}>
        {t("upNext")}
      </Text>

      {recommendations.isPending ? (
        <View style={{ gap: spacing.md }}>
          <SkeletonCard height={92} />
          <SkeletonCard height={92} />
        </View>
      ) : recommendations.isError ? (
        <Card tone="muted">
          <EmptyState
            icon={<Icon name="cloudOff" size={32} color={colors.textMuted} />}
            title={t("errorTitle")}
            body={t("errorBody")}
            action={<Button label={t("retry")} variant="secondary" onPress={() => void recommendations.refetch()} />}
          />
        </Card>
      ) : recommendations.data.length === 0 ? (
        <Card tone="muted">
          <EmptyState
            icon={<Icon name="sparkle" size={32} color={colors.primaryText} />}
            title={t("emptyTitle")}
            body={t("emptyBody")}
            action={<Button label={t("browse")} onPress={() => router.push("/(tabs)/learn")} />}
          />
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {recommendations.data.map((rec, index) => (
            <Animated.View key={`${rec.type}-${rec.lessonId ?? rec.courseSlug}-${index}`} entering={enter(index + 2)}>
              <Card
                onPress={() => openRecommendation(rec)}
                tone={index === 0 ? "primary" : "default"}
                accessibilityLabel={`${t(`type_${rec.type}`)}. ${rec.title}. ${rec.subtitle}. ${t("minutes", { n: rec.estimatedMinutes })}`}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: index === 0 ? colors.primary : colors.primarySoft,
                  }}
                >
                  <Icon name={TYPE_ICON[rec.type]} size={24} color={index === 0 ? colors.onPrimary : colors.primaryText} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label" tone="primary">
                    {t(`type_${rec.type}`).toUpperCase()}
                  </Text>
                  <Text variant="subheading" numberOfLines={2}>
                    {rec.title}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={2}>
                    {rec.subtitle}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
                  <Row gap={4}>
                    <Icon name="clock" size={14} color={colors.textMuted} />
                    <Text variant="caption" tone="muted">
                      {t("minutes", { n: rec.estimatedMinutes })}
                    </Text>
                  </Row>
                  <Icon name="chevronRight" size={20} color={colors.textSubtle} />
                </View>
              </Card>
            </Animated.View>
          ))}
        </View>
      )}

      {downloads.data && downloads.data.length > 0 ? (
        <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
          <Row gap={spacing.sm}>
            <Icon name="download" size={20} color={colors.successText} />
            <Text variant="heading">{t("offlineReady")}</Text>
          </Row>
          {downloads.data.slice(0, 4).map((lesson) => (
            <Card
              key={lesson.id}
              elevated={false}
              accessibilityLabel={t("openLesson", { title: lesson.title })}
              onPress={() =>
                router.push({
                  pathname: "/lesson/[id]",
                  params: lesson.courseSlug ? { id: lesson.id, course: lesson.courseSlug } : { id: lesson.id },
                })
              }
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}
            >
              <Icon name="book" size={20} color={colors.primaryText} />
              <Text variant="callout" style={{ flex: 1 }} numberOfLines={1}>
                {lesson.title}
              </Text>
              <Text variant="caption" tone="muted">
                {t("minutes", { n: lesson.estimatedMinutes })}
              </Text>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
