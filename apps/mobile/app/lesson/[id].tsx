import { useRef, useState } from "react";
import { ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Button, IconButton } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { Icon } from "../../src/components/Icon";
import { LessonBlocks } from "../../src/components/LessonBlocks";
import { EmptyState, Row, Skeleton, SkeletonText, Text } from "../../src/components/primitives";
import { ProgressBar } from "../../src/components/Progress";
import { useToast } from "../../src/components/Toast";
import { useCopy } from "../../src/i18n";
import { completeLesson } from "../../src/offline/learning";
import { OfflineMissError, queryKeys, useLesson } from "../../src/offline/data";
import { usePreferences, useSession } from "../../src/session/SessionProvider";
import { useTheme } from "../../src/theme/ThemeProvider";
import { brand } from "../../src/theme/tokens";

const copy = {
  close: "Close lesson",
  readProgress: "Reading progress",
  level: "Level {level}",
  minutes: "{n} min",
  savedOffline: "Saved offline",
  finish: "Finish lesson",
  doneTitle: "Lesson complete!",
  doneBody: "You showed up and did the work. That's how learning sticks.",
  doneQueued: "We'll add this to your progress as soon as you're back online.",
  xp: "+{xp} XP",
  continue: "Continue",
  practice: "Practice this skill",
  missingTitle: "This lesson isn't on your device yet",
  missingBody: "Download this lesson while you're online and it'll be ready anywhere.",
  errorTitle: "We couldn't open this lesson",
  retry: "Try again",
  finishFailed: "We couldn't save that just now. Please try again.",
};

function paramValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function LessonScreen() {
  const t = useCopy("lesson", copy);
  const params = useLocalSearchParams<{ id: string; course?: string }>();
  const id = paramValue(params.id) ?? "";
  const courseSlug = paramValue(params.course);
  const lesson = useLesson(id, courseSlug);
  const session = useSession();
  const { soundEffects } = usePreferences();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { colors, spacing, radii, reducedMotion } = useTheme();
  const startedAt = useRef(Date.now());
  const [readProgress, setReadProgress] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState<{ xp: number; queued: boolean } | null>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const scrollable = contentSize.height - layoutMeasurement.height;
    setReadProgress(scrollable <= 0 ? 1 : Math.min(1, Math.max(0, contentOffset.y / scrollable)));
  };

  const finish = async () => {
    setFinishing(true);
    try {
      const result = await completeLesson(id, Date.now() - startedAt.current);
      if (soundEffects) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setDone({ xp: result.xpEarned, queued: result.queued });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress });
      void session.refresh().catch(() => undefined);
    } catch {
      toast.show({ message: t("finishFailed"), tone: "error" });
    } finally {
      setFinishing(false);
    }
  };

  const topBar = (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.md }}>
      <Row justify="space-between">
        <IconButton icon="x" label={t("close")} onPress={() => router.back()} />
        {lesson.data?.downloaded ? <Chip label={t("savedOffline")} icon="download" tone="success" /> : null}
      </Row>
      <ProgressBar progress={done ? 1 : readProgress} height={6} accessibilityLabel={t("readProgress")} />
    </View>
  );

  if (done) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.lg }}>
          <Animated.View
            entering={reducedMotion ? undefined : ZoomIn.springify().damping(10)}
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.accentSoft,
            }}
          >
            <Icon name="trophy" size={60} color={brand.coral} />
          </Animated.View>
          <Text variant="display" align="center" accessibilityLiveRegion="polite">
            {t("doneTitle")}
          </Text>
          <Text tone="muted" align="center">
            {t("doneBody")}
          </Text>
          {done.xp > 0 ? <Chip label={t("xp", { xp: done.xp })} icon="sparkle" tone="primary" /> : null}
          {done.queued ? (
            <Text variant="caption" tone="subtle" align="center">
              {t("doneQueued")}
            </Text>
          ) : null}
        </View>
        <View style={{ padding: spacing.xl, gap: spacing.sm }}>
          <Button label={t("continue")} size="lg" onPress={() => router.back()} />
          {courseSlug ? (
            <Button
              label={t("practice")}
              variant="secondary"
              icon="target"
              onPress={() => router.replace({ pathname: "/practice/[slug]", params: { slug: courseSlug } })}
            />
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {topBar}
      {lesson.isPending ? (
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <Skeleton height={32} width="80%" />
          <SkeletonText lines={4} />
          <Skeleton height={180} radius={radii.md} />
          <SkeletonText lines={3} />
        </View>
      ) : lesson.isError ? (
        <EmptyState
          icon={<Icon name="cloudOff" size={40} color={colors.textMuted} />}
          title={lesson.error instanceof OfflineMissError ? t("missingTitle") : t("errorTitle")}
          body={lesson.error instanceof OfflineMissError ? t("missingBody") : undefined}
          action={<Button label={t("retry")} variant="secondary" onPress={() => void lesson.refetch()} />}
        />
      ) : (
        <>
          <ScrollView
            onScroll={onScroll}
            scrollEventThrottle={32}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(250)} style={{ gap: spacing.sm }}>
              <Text variant="title">{lesson.data.lesson.title}</Text>
              <Row gap={spacing.sm}>
                <Chip label={t("level", { level: lesson.data.lesson.level })} tone="primary" />
                <Chip label={t("minutes", { n: lesson.data.lesson.estimatedMinutes })} icon="clock" />
              </Row>
            </Animated.View>
            <LessonBlocks blocks={lesson.data.lesson.blocks} items={lesson.data.items} />
          </ScrollView>
          <View
            style={{
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.md,
              paddingBottom: spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            <Button label={t("finish")} size="lg" icon="check" loading={finishing} onPress={() => void finish()} testID="finish-lesson" />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
