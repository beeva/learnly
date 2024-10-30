import { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { randomUUID } from "expo-crypto";
import type { DiagnosticSummary, NextItemResponse, PublicItem, Response } from "@learnly/shared";
import { Button, IconButton } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { BandChip } from "../../src/components/Chip";
import { Icon } from "../../src/components/Icon";
import { isResponseReady, ItemView } from "../../src/components/ItemView";
import { EmptyState, Row, SkeletonCard, Text } from "../../src/components/primitives";
import { ProgressBar } from "../../src/components/Progress";
import { useToast } from "../../src/components/Toast";
import { useCopy } from "../../src/i18n";
import { isNetworkError, learningApi } from "../../src/lib/api";
import { itemRepo, masteryRepo } from "../../src/db/repo";
import { queryKeys, useCourse } from "../../src/offline/data";
import { useIsOnline } from "../../src/sync";
import { useTheme } from "../../src/theme/ThemeProvider";

const copy = {
  close: "Close placement check",
  introTitle: "Let's find your starting point",
  introBody: "No grades, no timer — just a few questions so your lessons fit you.",
  introPoint1: "About {n} questions, usually under 5 minutes",
  introPoint2: "It's fine to say “I'm not sure” by giving your best guess",
  introPoint3: "We won't mark answers right or wrong here",
  start: "Let's begin",
  progress: "Question {n} of about {total}",
  next: "Next",
  gotIt: "Got it — thanks!",
  offlineTitle: "This part needs a connection",
  offlineBody: "The placement check adapts as you answer, so it runs online. Your downloaded lessons still work offline.",
  back: "Go back",
  errorTitle: "Something interrupted us",
  errorBody: "Your answers so far are saved. Let's pick up where we left off.",
  retry: "Try again",
  summaryTitle: "Here's where you're starting",
  summaryBody: "This is a snapshot, not a score — it'll keep updating as you learn.",
  startLesson: "Start my first lesson",
  done: "Done",
  band_new: "Just starting",
  band_learning: "Learning",
  band_practicing: "Getting there",
  band_mastered: "Already strong",
  courseMissing: "We couldn't find this course.",
};

type Phase =
  | { kind: "intro" }
  | { kind: "question"; session: NextItemResponse["session"]; item: PublicItem; progress: NextItemResponse["progress"] }
  | { kind: "summary"; summary: DiagnosticSummary | null }
  | { kind: "error" };

function paramValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function DiagnosticScreen() {
  const t = useCopy("diagnostic", copy);
  const slug = paramValue(useLocalSearchParams<{ slug: string }>().slug);
  const course = useCourse(slug);
  const online = useIsOnline();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { colors, spacing, reducedMotion } = useTheme();
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [value, setValue] = useState<Response | null>(null);
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const sessionId = useRef<string | null>(null);
  const shownAt = useRef(Date.now());

  const showNext = async (next: NextItemResponse) => {
    sessionId.current = next.session.id;
    if (!next.item) {
      const result = await learningApi.completeSession(next.session.id).catch(() => null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      void queryClient.invalidateQueries({ queryKey: queryKeys.courseMastery(slug) });
      setPhase({ kind: "summary", summary: result?.summary ?? null });
      return;
    }
    await itemRepo.saveMany([next.item]).catch(() => undefined);
    setValue(null);
    shownAt.current = Date.now();
    setPhase({ kind: "question", session: next.session, item: next.item, progress: next.progress });
  };

  const handleError = (error: unknown) => {
    if (isNetworkError(error)) toast.show({ message: t("offlineTitle"), tone: "warning" });
    setPhase({ kind: "error" });
  };

  const start = async () => {
    if (!course.data) return;
    setBusy(true);
    try {
      await showNext(await learningApi.startSession({ courseId: course.data.course.id, kind: "diagnostic" }));
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    if (!sessionId.current) return start();
    setBusy(true);
    try {
      await showNext(await learningApi.nextItem(sessionId.current));
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (phase.kind !== "question" || !isResponseReady(value)) return;
    setBusy(true);
    try {
      const result = await learningApi.submitAttempt({
        itemId: phase.item.id,
        sessionId: phase.session.id,
        response: value,
        hintsUsed: 0,
        durationMs: Math.min(Date.now() - shownAt.current, 60 * 60 * 1000),
        clientAttemptId: randomUUID(),
      });
      await Promise.all([
        itemRepo.rememberKey(phase.item.id, result.correctResponse, result.explanation),
        masteryRepo.upsert([result.mastery], new Date().toISOString()),
      ]).catch(() => undefined);
      setAcknowledged(true);
      await new Promise((resolve) => setTimeout(resolve, reducedMotion ? 250 : 650));
      setAcknowledged(false);
      await showNext(await learningApi.nextItem(phase.session.id));
    } catch (error) {
      setAcknowledged(false);
      handleError(error);
    } finally {
      setBusy(false);
    }
  };

  const close = <IconButton icon="x" label={t("close")} onPress={() => router.back()} />;

  const body = (() => {
    if (phase.kind === "summary") {
      const points = phase.summary?.startingPoints ?? [];
      const lessonId = phase.summary?.recommendedLessonId ?? null;
      return (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
          <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(350)} style={{ gap: spacing.sm }}>
            <Icon name="sparkle" size={40} color={colors.primary} />
            <Text variant="title" accessibilityLiveRegion="polite">
              {t("summaryTitle")}
            </Text>
            <Text tone="muted">{t("summaryBody")}</Text>
          </Animated.View>
          <Card style={{ gap: spacing.md }}>
            {points.map((point) => (
              <Row key={point.skillId} justify="space-between" gap={spacing.md}>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {point.skillName}
                </Text>
                <BandChip band={point.band} label={t(`band_${point.band}`)} />
              </Row>
            ))}
          </Card>
          {lessonId ? (
            <Button
              label={t("startLesson")}
              size="lg"
              icon="arrowRight"
              iconPosition="trailing"
              onPress={() => router.replace({ pathname: "/lesson/[id]", params: { id: lessonId, course: slug } })}
            />
          ) : null}
          <Button label={t("done")} variant="secondary" onPress={() => router.back()} />
        </ScrollView>
      );
    }

    if (!online && phase.kind !== "question") {
      return (
        <EmptyState
          icon={<Icon name="wifi" size={40} color={colors.textMuted} />}
          title={t("offlineTitle")}
          body={t("offlineBody")}
          action={<Button label={t("back")} variant="secondary" onPress={() => router.back()} />}
        />
      );
    }

    if (phase.kind === "error") {
      return (
        <EmptyState
          icon={<Icon name="refresh" size={40} color={colors.textMuted} />}
          title={t("errorTitle")}
          body={t("errorBody")}
          action={<Button label={t("retry")} onPress={() => void resume()} loading={busy} />}
        />
      );
    }

    if (phase.kind === "intro") {
      if (course.isPending) return <SkeletonCard height={260} />;
      if (course.isError) return <EmptyState title={t("courseMissing")} />;
      return (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, flexGrow: 1, justifyContent: "center" }}>
          <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(400)} style={{ gap: spacing.md }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="compass" size={36} color={colors.primaryText} />
            </View>
            <Text variant="title">{t("introTitle")}</Text>
            <Text tone="muted">{t("introBody")}</Text>
            <Text variant="label" tone="primary">
              {course.data.course.title.toUpperCase()}
            </Text>
          </Animated.View>
          <View style={{ gap: spacing.md }}>
            {[t("introPoint1", { n: 12 }), t("introPoint2"), t("introPoint3")].map((point) => (
              <Row key={point} gap={spacing.md} align="flex-start">
                <Icon name="check" size={20} color={colors.successText} />
                <Text variant="callout" style={{ flex: 1 }}>
                  {point}
                </Text>
              </Row>
            ))}
          </View>
          <Button label={t("start")} size="lg" onPress={() => void start()} loading={busy} testID="diagnostic-start" />
        </ScrollView>
      );
    }

    const { item, progress } = phase;
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Animated.View key={item.id} entering={reducedMotion ? undefined : FadeIn.duration(250)}>
            <ItemView item={item} value={value} onChange={setValue} disabled={busy} />
          </Animated.View>
        </ScrollView>
        <View style={{ padding: spacing.xl, paddingTop: spacing.md, gap: spacing.sm }}>
          {acknowledged ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(150)}
              exiting={reducedMotion ? undefined : FadeOut.duration(150)}
              accessibilityLiveRegion="polite"
              style={{ alignItems: "center" }}
            >
              <Text variant="bodyStrong" tone="primary">
                {t("gotIt")}
              </Text>
            </Animated.View>
          ) : null}
          <Button
            label={t("next")}
            size="lg"
            icon="arrowRight"
            iconPosition="trailing"
            disabled={!isResponseReady(value)}
            loading={busy}
            onPress={() => void submit()}
            accessibilityHint={t("progress", { n: progress.answered + 1, total: progress.target })}
            testID="diagnostic-next"
          />
        </View>
      </View>
    );
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}>
        <Row justify="space-between">
          {close}
          {phase.kind === "question" ? (
            <Text variant="caption" tone="muted">
              {t("progress", { n: phase.progress.answered + 1, total: phase.progress.target })}
            </Text>
          ) : null}
        </Row>
        {phase.kind === "question" ? (
          <ProgressBar
            progress={phase.progress.answered / Math.max(1, phase.progress.target)}
            height={6}
            accessibilityLabel={t("progress", { n: phase.progress.answered + 1, total: phase.progress.target })}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, justifyContent: phase.kind === "intro" ? "center" : "flex-start" }}>{body}</View>
    </SafeAreaView>
  );
}
