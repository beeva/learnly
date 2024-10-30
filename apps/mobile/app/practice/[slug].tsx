import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { recommendPace, REASON_COPY, type PaceSignal } from "@learnly/adaptive-engine";
import type { PublicItem, Response } from "@learnly/shared";
import { Button, IconButton } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Chip } from "../../src/components/Chip";
import { FeedbackSheet } from "../../src/components/FeedbackSheet";
import { Icon } from "../../src/components/Icon";
import { isResponseReady, ItemView } from "../../src/components/ItemView";
import { EmptyState, Row, SkeletonCard, SkeletonText, Text } from "../../src/components/primitives";
import { ProgressBar, ProgressRing } from "../../src/components/Progress";
import { useCopy } from "../../src/i18n";
import { isNetworkError, learningApi } from "../../src/lib/api";
import { itemRepo } from "../../src/db/repo";
import { nextOfflineItem, submitAnswer, type AnswerOutcome } from "../../src/offline/learning";
import { queryKeys, useCourse } from "../../src/offline/data";
import { isOnlineNow } from "../../src/sync";
import { useSession } from "../../src/session/SessionProvider";
import { useTheme } from "../../src/theme/ThemeProvider";
import { brand } from "../../src/theme/tokens";

const TARGET_ITEMS = 8;

const copy = {
  close: "End practice",
  closeTitle: "Take a break?",
  closeBody: "Your answers so far are saved.",
  keepGoing: "Keep going",
  leave: "End session",
  progress: "{n} of {total}",
  offlineMode: "Offline practice",
  check: "Check",
  hint: "Show a hint",
  nextHint: "Another hint",
  hintLabel: "Hint {n}",
  slowDown: "Let's slow down a little — have a look at the hint before answering.",
  continue: "Continue",
  finish: "See my results",
  loadingTitle: "Picking a good first question…",
  emptyTitle: "Nothing to practice offline yet",
  emptyBody: "Download this course while you're online and you can practice anywhere.",
  errorTitle: "We couldn't start practice",
  retry: "Try again",
  back: "Go back",
  summaryTitle: "Session complete!",
  summaryGreat: "Brilliant focus. You're building real momentum.",
  summaryGood: "Solid work — every answer teaches your brain something.",
  summaryGentle: "Tough set! That struggle is exactly where learning happens.",
  accuracy: "Accuracy",
  accuracyRing: "{percent} percent correct",
  correctCount: "{correct} of {total} correct",
  xpEarned: "+{xp} XP",
  savedForLater: "{n} answers will be checked when you're back online.",
  again: "Practice again",
  done: "Done",
};

type Mode = "online" | "offline";

interface Current {
  item: PublicItem;
  rationale: string | null;
}

interface Stats {
  answered: number;
  correct: number;
  pendingChecks: number;
  xp: number;
}

function paramValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const EMPTY_STATS: Stats = { answered: 0, correct: 0, pendingChecks: 0, xp: 0 };

export default function PracticeScreen() {
  const t = useCopy("practice", copy);
  const reasons = useCopy("reasons", REASON_COPY);
  const slug = paramValue(useLocalSearchParams<{ slug: string }>().slug);
  const course = useCourse(slug);
  const session = useSession();
  const queryClient = useQueryClient();
  const { colors, spacing, radii, reducedMotion } = useTheme();

  const [status, setStatus] = useState<"loading" | "active" | "empty" | "error" | "done">("loading");
  const [mode, setMode] = useState<Mode>("online");
  const [current, setCurrent] = useState<Current | null>(null);
  const [value, setValue] = useState<Response | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [run, setRun] = useState(0);

  const sessionId = useRef<string | null>(null);
  const shownAt = useRef(Date.now());
  const history = useRef<{ itemIds: string[]; skillIds: string[]; correct: boolean[] }>({
    itemIds: [],
    skillIds: [],
    correct: [],
  });
  const signals = useRef<PaceSignal[]>([]);
  const streak = useRef({ correctInRow: 0, missesInRow: 0 });

  const skillIds = useMemo(
    () => course.data?.units.flatMap((u) => u.skills.map((s) => s.id as string)) ?? [],
    [course.data],
  );
  const courseId = course.data?.course.id ?? null;

  const present = useCallback((next: Current) => {
    setCurrent(next);
    setValue(null);
    setHintsShown(0);
    setOutcome(null);
    shownAt.current = Date.now();
    setStatus("active");
  }, []);

  const pickOffline = useCallback(async (): Promise<boolean> => {
    setMode("offline");
    const pick = await nextOfflineItem(skillIds, history.current);
    if (!pick) return false;
    present({ item: pick.item, rationale: reasons(pick.reason) });
    return true;
  }, [present, reasons, skillIds]);

  const begin = useCallback(async () => {
    if (!courseId) return;
    setStatus("loading");
    try {
      if (isOnlineNow()) {
        try {
          const first = await learningApi.startSession({ courseId, kind: "practice", targetItems: TARGET_ITEMS });
          sessionId.current = first.session.id;
          if (first.item) {
            await itemRepo.saveMany([first.item]).catch(() => undefined);
            setMode("online");
            present({ item: first.item, rationale: first.rationale || null });
            return;
          }
        } catch (error) {
          if (!isNetworkError(error)) throw error;
        }
      }
      if (!(await pickOffline())) setStatus("empty");
    } catch {
      setStatus("error");
    }
  }, [courseId, pickOffline, present]);

  // Start once per run; later course refetches must not restart a session mid-way.
  const startedRun = useRef<number | null>(null);
  useEffect(() => {
    if (!courseId || startedRun.current === run) return;
    startedRun.current = run;
    void begin();
  }, [begin, courseId, run]);

  const finish = useCallback(async () => {
    setStatus("done");
    if (sessionId.current && isOnlineNow()) {
      await learningApi.completeSession(sessionId.current).catch(() => undefined);
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.progress });
    void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
    void queryClient.invalidateQueries({ queryKey: queryKeys.courseMastery(slug) });
    void session.refresh().catch(() => undefined);
  }, [queryClient, session, slug]);

  const check = async () => {
    if (!current || !isResponseReady(value)) return;
    setBusy(true);
    const durationMs = Date.now() - shownAt.current;
    try {
      const result = await submitAnswer({
        item: current.item,
        response: value,
        hintsUsed: hintsShown,
        durationMs,
        sessionId: sessionId.current,
        correctInRow: streak.current.correctInRow,
        missesInRow: streak.current.missesInRow,
      });
      const correct = result.status === "scored" ? result.correct : null;
      history.current.itemIds.push(current.item.id);
      history.current.skillIds.push(current.item.skillId);
      if (correct !== null) {
        history.current.correct.push(correct);
        signals.current.push({ correct, durationMs, hintsUsed: hintsShown });
        streak.current = correct
          ? { correctInRow: streak.current.correctInRow + 1, missesInRow: 0 }
          : { correctInRow: 0, missesInRow: streak.current.missesInRow + 1 };
      }
      if (result.status === "scored" && result.source === "local") setMode("offline");
      setStats((s) => ({
        answered: s.answered + 1,
        correct: s.correct + (correct ? 1 : 0),
        pendingChecks: s.pendingChecks + (correct === null ? 1 : 0),
        xp: s.xp + result.xpEarned,
      }));
      setOutcome(result);
    } finally {
      setBusy(false);
    }
  };

  const advance = async () => {
    if (stats.answered >= TARGET_ITEMS) {
      setOutcome(null);
      await finish();
      return;
    }
    setBusy(true);
    try {
      if (mode === "online" && sessionId.current && isOnlineNow()) {
        try {
          const next = await learningApi.nextItem(sessionId.current);
          if (!next.item) {
            setOutcome(null);
            await finish();
            return;
          }
          await itemRepo.saveMany([next.item]).catch(() => undefined);
          present({ item: next.item, rationale: next.rationale || null });
          return;
        } catch (error) {
          if (!isNetworkError(error)) throw error;
        }
      }
      if (!(await pickOffline())) {
        setOutcome(null);
        await finish();
      }
    } catch {
      setOutcome(null);
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (stats.answered === 0 || status === "done") {
      router.back();
      return;
    }
    Alert.alert(t("closeTitle"), t("closeBody"), [
      { text: t("keepGoing"), style: "cancel" },
      { text: t("leave"), onPress: () => void finish().then(() => router.back()) },
    ]);
  };

  const again = () => {
    sessionId.current = null;
    history.current = { itemIds: [], skillIds: [], correct: [] };
    signals.current = [];
    streak.current = { correctInRow: 0, missesInRow: 0 };
    setStats(EMPTY_STATS);
    setCurrent(null);
    setRun((r) => r + 1);
  };

  const pace = recommendPace(signals.current);
  const progressRatio = Math.min(1, stats.answered / TARGET_ITEMS);

  const topBar = (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}>
      <Row justify="space-between">
        <IconButton icon="x" label={t("close")} onPress={close} />
        <Row gap={spacing.sm}>
          {mode === "offline" && status !== "done" ? <Chip label={t("offlineMode")} icon="cloudOff" tone="warning" /> : null}
          {status === "active" ? (
            <Text variant="label" tone="muted">
              {t("progress", { n: Math.min(stats.answered + 1, TARGET_ITEMS), total: TARGET_ITEMS })}
            </Text>
          ) : null}
        </Row>
      </Row>
      {status !== "done" ? (
        <ProgressBar
          progress={progressRatio}
          height={8}
          color={colors.success}
          accessibilityLabel={t("progress", { n: stats.answered, total: TARGET_ITEMS })}
        />
      ) : null}
    </View>
  );

  if (status === "done") {
    const scoredCount = stats.answered - stats.pendingChecks;
    const accuracy = scoredCount > 0 ? stats.correct / scoredCount : 0;
    const message = accuracy >= 0.8 ? t("summaryGreat") : accuracy >= 0.5 ? t("summaryGood") : t("summaryGentle");
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {topBar}
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.lg }}>
          <Animated.View
            entering={reducedMotion ? undefined : ZoomIn.springify().damping(12)}
            style={{ alignItems: "center", gap: spacing.lg }}
          >
            <ProgressRing
              progress={accuracy}
              size={168}
              strokeWidth={16}
              color={colors.success}
              colorEnd={brand.mint}
              accessibilityLabel={t("accuracyRing", { percent: Math.round(accuracy * 100) })}
            >
              <Text variant="display">{Math.round(accuracy * 100)}%</Text>
              <Text variant="caption" tone="muted">
                {t("accuracy")}
              </Text>
            </ProgressRing>
            <Text variant="title" align="center" accessibilityLiveRegion="polite">
              {t("summaryTitle")}
            </Text>
            <Text tone="muted" align="center">
              {message}
            </Text>
            <Row gap={spacing.sm} justify="center" wrap>
              <Chip label={t("correctCount", { correct: stats.correct, total: stats.answered })} icon="check" tone="success" />
              {stats.xp > 0 ? <Chip label={t("xpEarned", { xp: stats.xp })} icon="sparkle" tone="primary" /> : null}
            </Row>
            {stats.pendingChecks > 0 ? (
              <Text variant="caption" tone="subtle" align="center">
                {t("savedForLater", { n: stats.pendingChecks })}
              </Text>
            ) : null}
          </Animated.View>
        </ScrollView>
        <View style={{ padding: spacing.xl, gap: spacing.sm }}>
          <Button label={t("again")} icon="refresh" onPress={again} />
          <Button label={t("done")} variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (status === "loading" || course.isPending) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {topBar}
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <Text tone="muted" accessibilityLiveRegion="polite">
            {t("loadingTitle")}
          </Text>
          <SkeletonText lines={2} />
          <SkeletonCard height={64} />
          <SkeletonCard height={64} />
          <SkeletonCard height={64} />
        </View>
      </SafeAreaView>
    );
  }

  if (status === "empty" || status === "error" || course.isError || !current) {
    const empty = status === "empty";
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {topBar}
        <EmptyState
          icon={<Icon name={empty ? "download" : "cloudOff"} size={40} color={colors.textMuted} />}
          title={empty ? t("emptyTitle") : t("errorTitle")}
          body={empty ? t("emptyBody") : undefined}
          action={
            empty ? (
              <Button label={t("back")} variant="secondary" onPress={() => router.back()} />
            ) : (
              <Button label={t("retry")} onPress={again} />
            )
          }
        />
      </SafeAreaView>
    );
  }

  const hints = current.item.hints;
  const last = stats.answered >= TARGET_ITEMS;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {topBar}
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl * 3 }}
        keyboardShouldPersistTaps="handled"
      >
        {current.rationale ? (
          <Row gap={spacing.xs}>
            <Icon name="sparkle" size={14} color={colors.textSubtle} />
            <Text variant="caption" tone="subtle">
              {current.rationale}
            </Text>
          </Row>
        ) : null}

        <Animated.View key={`${current.item.id}-${stats.answered}`} entering={reducedMotion ? undefined : FadeInDown.duration(260)}>
          <ItemView
            item={current.item}
            value={value}
            onChange={setValue}
            disabled={Boolean(outcome) || busy}
            reveal={
              outcome?.status === "scored" ? { correct: outcome.correct, correctResponse: outcome.correctResponse } : null
            }
          />
        </Animated.View>

        {pace.decision === "slow_down" && hintsShown === 0 && hints.length > 0 && !outcome ? (
          <Card tone="warning" elevated={false}>
            <Text variant="callout" tone="warning">
              {t("slowDown")}
            </Text>
          </Card>
        ) : null}

        {hints.slice(0, hintsShown).map((hint, i) => (
          <Animated.View
            key={`${current.item.id}-hint-${i}`}
            entering={reducedMotion ? undefined : FadeIn.duration(200)}
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: "row",
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: radii.md,
              backgroundColor: colors.primarySoft,
            }}
          >
            <Icon name="lightbulb" size={18} color={colors.primaryText} />
            <View style={{ flex: 1 }}>
              <Text variant="label" tone="primary">
                {t("hintLabel", { n: i + 1 })}
              </Text>
              <Text variant="callout" tone="primary">
                {hint}
              </Text>
            </View>
          </Animated.View>
        ))}
      </ScrollView>

      {!outcome ? (
        <View
          style={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: spacing.lg,
            gap: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          {hintsShown < hints.length ? (
            <Button
              label={hintsShown === 0 ? t("hint") : t("nextHint")}
              variant="ghost"
              icon="lightbulb"
              onPress={() => setHintsShown((n) => Math.min(hints.length, n + 1))}
            />
          ) : null}
          <Button
            label={t("check")}
            size="lg"
            disabled={!isResponseReady(value)}
            loading={busy}
            onPress={() => void check()}
            testID="practice-check"
          />
        </View>
      ) : null}

      <FeedbackSheet
        outcome={outcome}
        item={current.item}
        continueLabel={last ? t("finish") : t("continue")}
        onContinue={() => void advance()}
      />
    </SafeAreaView>
  );
}
