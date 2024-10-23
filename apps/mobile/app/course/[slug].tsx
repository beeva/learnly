import { useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeIn } from "react-native-reanimated";
import type { MasteryBand, SkillMastery, Unit } from "@learnly/shared";
import { Button, IconButton } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { BandChip, Chip } from "../../src/components/Chip";
import { Icon } from "../../src/components/Icon";
import { EmptyState, Row, Screen, SkeletonCard, SkeletonText, Text } from "../../src/components/primitives";
import { ProgressBar } from "../../src/components/Progress";
import { useToast } from "../../src/components/Toast";
import { useCopy } from "../../src/i18n";
import { lessonRepo } from "../../src/db/repo";
import {
  downloadCourse,
  OfflineMissError,
  queryKeys,
  useCourse,
  useCourseMastery,
  useSkillLessons,
  type DownloadProgress,
} from "../../src/offline/data";
import { useIsOnline } from "../../src/sync";
import { useTheme } from "../../src/theme/ThemeProvider";
import { CourseCover } from "../(tabs)/learn";

const copy = {
  back: "Back",
  placement: "Start placement check",
  placementHint: "A few relaxed questions to find your starting point",
  practice: "Practice",
  download: "Download for offline",
  downloading: "Downloading {done} of {total} lessons…",
  downloaded: "{count} lessons are ready offline",
  downloadFailed: "The download paused. Your saved lessons are kept — try again when you're online.",
  downloadOffline: "Connect to the internet to download this course.",
  unit: "Unit {n}",
  skills: "{n} skills",
  lessons: "Lessons",
  noLessons: "Lessons for this skill are on their way.",
  lessonsOffline: "Connect to see this skill's lessons.",
  level: "Level {level} of 5",
  minutes: "{n} min",
  savedOffline: "Saved offline",
  openLesson: "{title}, {minutes} minutes, level {level}",
  band_new: "New",
  band_learning: "Learning",
  band_practicing: "Practicing",
  band_mastered: "Mastered",
  notFoundTitle: "We couldn't open this course",
  notFoundOffline: "It hasn't been downloaded yet. Connect once and it'll be here next time.",
  retry: "Try again",
};

function paramValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function LevelDots({ level }: { level: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 3 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <View
          key={n}
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: n <= level ? colors.primary : colors.ringTrack }}
        />
      ))}
    </View>
  );
}

function SkillLessons({ skillId, slug, downloaded }: { skillId: string; slug: string; downloaded: Set<string> }) {
  const t = useCopy("course", copy);
  const { colors, spacing } = useTheme();
  const lessons = useSkillLessons(skillId, true);

  if (lessons.isPending) return <SkeletonText lines={2} />;
  if (lessons.isError) {
    return (
      <Text variant="caption" tone="muted">
        {t("lessonsOffline")}
      </Text>
    );
  }
  if (lessons.data.length === 0) {
    return (
      <Text variant="caption" tone="muted">
        {t("noLessons")}
      </Text>
    );
  }
  return (
    <View style={{ gap: spacing.xs }}>
      {[...lessons.data]
        .sort((a, b) => a.level - b.level)
        .map((lesson) => {
          const isSaved = downloaded.has(lesson.id);
          return (
            <Pressable
              key={lesson.id}
              accessibilityRole="button"
              accessibilityLabel={`${t("openLesson", {
                title: lesson.title,
                minutes: lesson.estimatedMinutes,
                level: lesson.level,
              })}${isSaved ? `. ${t("savedOffline")}` : ""}`}
              onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: lesson.id, course: slug } })}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                minHeight: 52,
                paddingHorizontal: spacing.md,
                borderRadius: 12,
                backgroundColor: pressed ? colors.surfaceMuted : "transparent",
              })}
            >
              <Icon name="play" size={16} color={colors.primaryText} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="callout" numberOfLines={2}>
                  {lesson.title}
                </Text>
                <Row gap={spacing.sm}>
                  <LevelDots level={lesson.level} />
                  <Text variant="caption" tone="muted">
                    {t("minutes", { n: lesson.estimatedMinutes })}
                  </Text>
                </Row>
              </View>
              {isSaved ? <Icon name="download" size={16} color={colors.successText} label={t("savedOffline")} /> : null}
            </Pressable>
          );
        })}
    </View>
  );
}

function UnitSection({
  unit,
  slug,
  mastery,
  downloaded,
  defaultOpen,
}: {
  unit: Unit;
  slug: string;
  mastery: Map<string, SkillMastery> | undefined;
  downloaded: Set<string>;
  defaultOpen: boolean;
}) {
  const t = useCopy("course", copy);
  const { colors, spacing, reducedMotion } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const scores = unit.skills.map((s) => {
    const m = mastery?.get(s.id);
    return m && m.attempts > 0 ? m.pKnown : 0;
  });
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const bandLabel = (band: MasteryBand) => t(`band_${band}`);

  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${t("unit", { n: unit.position })}: ${unit.title}. ${t("skills", { n: unit.skills.length })}`}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => ({ padding: spacing.lg, gap: spacing.sm, backgroundColor: pressed ? colors.surfaceMuted : "transparent" })}
      >
        <Row justify="space-between">
          <Text variant="label" tone="primary">
            {t("unit", { n: unit.position }).toUpperCase()}
          </Text>
          <Icon name={open ? "chevronUp" : "chevronDown"} size={20} color={colors.textMuted} />
        </Row>
        <Text variant="heading">{unit.title}</Text>
        <Text variant="callout" tone="muted">
          {unit.summary}
        </Text>
        <ProgressBar progress={avg} color={avg >= 0.85 ? colors.success : colors.primary} style={{ marginTop: spacing.xs }} />
      </Pressable>
      {open ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(200)}
          style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg }}
        >
          {unit.skills.map((skill) => {
            const band = mastery?.get(skill.id)?.band ?? "new";
            return (
              <View key={skill.id} style={{ gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
                <Row justify="space-between" gap={spacing.md}>
                  <Text variant="bodyStrong" style={{ flex: 1 }}>
                    {skill.name}
                  </Text>
                  <BandChip band={band} label={bandLabel(band)} />
                </Row>
                <SkillLessons skillId={skill.id} slug={slug} downloaded={downloaded} />
              </View>
            );
          })}
        </Animated.View>
      ) : null}
    </Card>
  );
}

export default function CourseScreen() {
  const t = useCopy("course", copy);
  const slug = paramValue(useLocalSearchParams<{ slug: string }>().slug);
  const { colors, spacing, radii } = useTheme();
  const online = useIsOnline();
  const toast = useToast();
  const queryClient = useQueryClient();
  const course = useCourse(slug);
  const mastery = useCourseMastery(slug);
  const downloadedIds = useQuery({
    queryKey: [...queryKeys.downloads, "ids", slug],
    networkMode: "always",
    queryFn: () => lessonRepo.downloadedIds(slug),
  });
  const [download, setDownload] = useState<DownloadProgress | null>(null);

  const startDownload = async () => {
    if (!online) {
      toast.show({ message: t("downloadOffline"), tone: "warning" });
      return;
    }
    setDownload({ done: 0, total: 0 });
    try {
      const total = await downloadCourse(slug, { onProgress: setDownload });
      toast.show({ message: t("downloaded", { count: total }), tone: "success" });
    } catch {
      toast.show({ message: t("downloadFailed"), tone: "error" });
    } finally {
      setDownload(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.downloads });
    }
  };

  const header = (
    <Row justify="space-between">
      <IconButton icon="arrowLeft" label={t("back")} onPress={() => router.back()} />
    </Row>
  );

  if (course.isPending) {
    return (
      <Screen>
        {header}
        <SkeletonCard height={160} />
        <SkeletonText lines={3} />
        <SkeletonCard height={120} />
        <SkeletonCard height={120} />
      </Screen>
    );
  }

  if (course.isError) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={<Icon name="cloudOff" size={36} color={colors.textMuted} />}
          title={t("notFoundTitle")}
          body={course.error instanceof OfflineMissError ? t("notFoundOffline") : undefined}
          action={<Button label={t("retry")} variant="secondary" onPress={() => void course.refetch()} />}
        />
      </Screen>
    );
  }

  const { course: info, units } = course.data;
  const downloadedSet = downloadedIds.data ?? new Set<string>();

  return (
    <Screen refreshing={course.isRefetching} onRefresh={() => void Promise.all([course.refetch(), mastery.refetch()])}>
      {header}
      <View style={{ borderRadius: radii.lg, overflow: "hidden" }}>
        <CourseCover hue={info.coverHue} height={140} radius={radii.lg} />
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text variant="title">{info.title}</Text>
        <Text tone="muted">{info.description}</Text>
        <Row gap={spacing.sm} wrap>
          <Chip label={info.gradeBand.toUpperCase()} tone="primary" />
          <Chip label={t("minutes", { n: info.estimatedMinutes })} icon="clock" />
          {downloadedSet.size > 0 ? <Chip label={t("savedOffline")} icon="download" tone="success" /> : null}
        </Row>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button
          label={t("placement")}
          icon="compass"
          accessibilityHint={t("placementHint")}
          onPress={() => router.push({ pathname: "/diagnostic/[slug]", params: { slug } })}
        />
        <Row gap={spacing.sm}>
          <View style={{ flex: 1 }}>
            <Button
              label={t("practice")}
              variant="secondary"
              icon="target"
              onPress={() => router.push({ pathname: "/practice/[slug]", params: { slug } })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={t("download")}
              variant="secondary"
              icon="download"
              loading={download !== null}
              onPress={() => void startDownload()}
            />
          </View>
        </Row>
        {download && download.total > 0 ? (
          <View style={{ gap: spacing.xs }} accessibilityLiveRegion="polite">
            <ProgressBar progress={download.done / download.total} color={colors.success} />
            <Text variant="caption" tone="muted">
              {t("downloading", { done: download.done, total: download.total })}
            </Text>
          </View>
        ) : null}
      </View>

      {[...units]
        .sort((a, b) => a.position - b.position)
        .map((unit, index) => (
          <UnitSection
            key={unit.id}
            unit={unit}
            slug={slug}
            mastery={mastery.data}
            downloaded={downloadedSet}
            defaultOpen={index === 0}
          />
        ))}
    </Screen>
  );
}
