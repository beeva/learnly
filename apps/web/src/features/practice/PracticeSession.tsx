import { levelForXp, type AttemptResult, type NextItemResponse, type Response, type SessionKind, type SkillMastery } from "@learnly/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { isApiError } from "../../api/client";
import { useCompleteSession, useCourse, useNextItem, useProgress, useStartSession, useSubmitAttempt } from "../../api/hooks";
import { useSoundEffects } from "../../hooks/preferences";
import { useT } from "../../i18n/I18nProvider";
import { CourseCover } from "../../pages/Courses";
import { Badge, Banner, Button, ButtonLink, Card, Dialog, EmptyState, IconButton, ProgressRing, Skeleton, Spinner, cx } from "../../ui/components";
import { ArrowRightIcon, ChartIcon, ClockIcon, CloseIcon, CompassIcon, HomeIcon, LightbulbIcon, RefreshIcon, SparklesIcon, TargetIcon } from "../../ui/icons";
import { MasteryCelebration } from "./Celebration";
import { FeedbackPanel } from "./FeedbackPanel";
import { ItemView } from "./ItemView";
import { describeResponse, draftProblem, emptyDraft, toResponse, type Draft } from "./responses";
import styles from "./Practice.module.css";

const TARGET_ITEMS = 8;

type Phase =
  | { name: "intro" }
  | { name: "loading" }
  | { name: "question"; data: NextItemResponse; shownAt: number }
  | { name: "feedback"; data: NextItemResponse; result: AttemptResult; submitted: Response }
  | { name: "summary"; xpEarned: number; answered: number; correct: number }
  | { name: "error"; offline: boolean; retry: () => void };

interface SkillDelta {
  skillId: string;
  before: number;
  after: SkillMastery;
}

/** Segmented progress: one pill per question, the current one stretched. */
export function SessionDots({ answered, target, label }: { answered: number; target: number; label: string }) {
  return (
    <div className={styles.dots} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={target} aria-valuenow={answered}>
      {Array.from({ length: target }, (_, i) => (
        <span key={i} className={cx(styles.dot, i < answered && styles.dotDone, i === answered && styles.dotCurrent)} />
      ))}
    </div>
  );
}

export function PracticePage() {
  const { courseSlug } = useParams();
  const [params] = useSearchParams();
  const kind: SessionKind = params.get("kind") === "review" ? "review" : "practice";
  const navigate = useNavigate();
  const { t } = useT();
  const play = useSoundEffects();

  const course = useCourse(courseSlug);
  const progress = useProgress();
  const startSession = useStartSession();
  const nextItem = useNextItem();
  const submitAttempt = useSubmitAttempt();
  const completeSession = useCompleteSession();

  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [nudge, setNudge] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const sessionId = useRef<string | null>(null);
  const streak = useRef(0);
  const deltas = useRef(new Map<string, SkillDelta>());

  const skillNames = useMemo(
    () => new Map((course.data?.units ?? []).flatMap((unit) => unit.skills.map((skill) => [skill.id as string, skill.name]))),
    [course.data],
  );

  const showQuestion = useCallback((data: NextItemResponse) => {
    if (!data.item) return false;
    setDraft(emptyDraft(data.item));
    setHintsShown(0);
    setNudge(null);
    setPhase({ name: "question", data, shownAt: performance.now() });
    return true;
  }, []);

  const finish = useCallback(async () => {
    const id = sessionId.current;
    if (!id) return;
    setPhase({ name: "loading" });
    try {
      const done = await completeSession.mutateAsync(id);
      setPhase({ name: "summary", xpEarned: done.xpEarned, answered: done.session.itemsAnswered, correct: done.session.itemsCorrect });
    } catch (error) {
      setPhase({ name: "error", offline: isApiError(error, "network"), retry: () => void finish() });
    }
  }, [completeSession]);

  const begin = useCallback(async () => {
    if (!course.data) return;
    setPhase({ name: "loading" });
    streak.current = 0;
    deltas.current = new Map();
    try {
      const data = await startSession.mutateAsync({ courseId: course.data.course.id, kind, targetItems: TARGET_ITEMS });
      sessionId.current = data.session.id;
      if (!showQuestion(data)) await finish();
    } catch (error) {
      setPhase({ name: "error", offline: isApiError(error, "network"), retry: () => void begin() });
    }
  }, [course.data, finish, kind, showQuestion, startSession]);

  const advance = useCallback(async () => {
    const id = sessionId.current;
    if (!id) return;
    setPhase({ name: "loading" });
    try {
      const data = await nextItem.mutateAsync(id);
      if (!showQuestion(data)) await finish();
    } catch (error) {
      setPhase({ name: "error", offline: isApiError(error, "network"), retry: () => void advance() });
    }
  }, [finish, nextItem, showQuestion]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (phase.name !== "question" || !draft || !phase.data.item || submitAttempt.isPending) return;
    const response = toResponse(draft);
    if (!response) {
      const problem = draftProblem(draft);
      setNudge(problem ? t(`practice.nudge.${problem}`) : null);
      return;
    }
    const item = phase.data.item;
    const before = progress.data?.mastery.find((m) => m.skillId === item.skillId)?.pKnown ?? deltas.current.get(item.skillId)?.after.pKnown ?? 0;
    try {
      const result = await submitAttempt.mutateAsync({
        itemId: item.id,
        sessionId: phase.data.session.id,
        response,
        hintsUsed: hintsShown,
        durationMs: Math.round(performance.now() - phase.shownAt),
        clientAttemptId: crypto.randomUUID(),
        answeredAt: new Date().toISOString(),
      });
      streak.current = result.correct ? streak.current + 1 : 0;
      const existing = deltas.current.get(item.skillId);
      deltas.current.set(item.skillId, { skillId: item.skillId, before: existing?.before ?? before, after: result.mastery });
      if (result.encouragementKey === "mastered") {
        setCelebrate(skillNames.get(item.skillId) ?? "");
        play("mastered");
      } else if (result.correct) {
        play(result.encouragementKey === "level_up" ? "levelUp" : "correct");
      }
      setPhase({ name: "feedback", data: phase.data, result, submitted: response });
    } catch (error) {
      setNudge(isApiError(error, "network") ? t("practice.offline") : t("practice.error"));
    }
  }

  const answered = phase.name === "question" || phase.name === "feedback" ? phase.data.progress.answered + (phase.name === "feedback" ? 1 : 0) : 0;
  const target = phase.name === "question" || phase.name === "feedback" ? phase.data.progress.target : TARGET_ITEMS;
  const inSession = phase.name === "question" || phase.name === "feedback" || phase.name === "loading";

  function requestLeave() {
    if (inSession && answered > 0) setLeaving(true);
    else navigate(-1);
  }

  if (course.isPending) {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton height={28} width={220} />
        <div style={{ height: 24 }} />
        <Skeleton height={320} radius={24} />
      </div>
    );
  }

  if (!course.data) {
    return (
      <EmptyState
        icon={CompassIcon}
        title={t("practice.courseMissing")}
        action={
          <ButtonLink to="/courses" variant="secondary">
            {t("nav.courses")}
          </ButtonLink>
        }
      />
    );
  }

  const courseTitle = course.data.course.title;

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <IconButton icon={CloseIcon} label={t("practice.leave")} onClick={requestLeave} />
        {inSession ? (
          <div className={styles.topProgress}>
            <SessionDots answered={answered} target={target} label={t("practice.progress", { current: Math.min(answered + 1, target), total: target })} />
          </div>
        ) : (
          <span className={styles.topTitle}>{kind === "review" ? t("practice.reviewTitle", { course: courseTitle }) : t("practice.title")}</span>
        )}
        <span className={styles.topCount} aria-hidden={!inSession}>
          {inSession ? `${Math.min(answered + (phase.name === "feedback" ? 0 : 1), target)}/${target}` : ""}
        </span>
      </header>

      <AnimatePresence mode="wait">
        {phase.name === "intro" ? (
          <motion.div key="intro" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Card padding="none" className={styles.intro}>
              <CourseCover course={course.data.course} size="sm" />
              <div className={styles.introBody}>
                <h1 className={styles.introTitle}>{kind === "review" ? t("practice.reviewTitle", { course: courseTitle }) : t("practice.introTitle", { course: courseTitle })}</h1>
                <p className={styles.introText}>{t("practice.introBody", { count: TARGET_ITEMS })}</p>
                <ul role="list" className={styles.tips}>
                  <li>
                    <ClockIcon size={18} /> {t("practice.tip.noTimer")}
                  </li>
                  <li>
                    <LightbulbIcon size={18} /> {t("practice.tip.hints")}
                  </li>
                  <li>
                    <TargetIcon size={18} /> {t("practice.tip.adaptive")}
                  </li>
                </ul>
                <Button size="lg" trailingIcon={ArrowRightIcon} loading={startSession.isPending} onClick={() => void begin()}>
                  {t("practice.start")}
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : null}

        {phase.name === "loading" ? (
          <motion.div key="loading" className={styles.loading} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status">
            <Spinner size={28} />
            <span>{t("practice.loading")}</span>
          </motion.div>
        ) : null}

        {phase.name === "error" ? (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmptyState
              icon={RefreshIcon}
              title={phase.offline ? t("practice.offlineTitle") : t("practice.error")}
              description={phase.offline ? t("practice.offline") : undefined}
              action={
                <Button leadingIcon={RefreshIcon} onClick={phase.retry}>
                  {t("common.retry")}
                </Button>
              }
            />
          </motion.div>
        ) : null}

        {(phase.name === "question" || phase.name === "feedback") && phase.data.item && draft ? (
          <motion.form
            key={phase.data.item.id}
            className={styles.questionCard}
            onSubmit={(event) => void submit(event)}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            noValidate
          >
            <div className={styles.questionMeta}>
              <Badge tone="primary" size="sm">
                {skillNames.get(phase.data.item.skillId) ?? courseTitle}
              </Badge>
              {phase.data.rationale ? (
                <span className={styles.rationale} title={t("practice.why")}>
                  <SparklesIcon size={14} />
                  <span className="sr-only">{t("practice.why")}: </span>
                  {phase.data.rationale}
                </span>
              ) : null}
            </div>

            <ItemView
              item={phase.data.item}
              draft={draft}
              onDraftChange={(next) => {
                setDraft(next);
                setNudge(null);
              }}
              onSubmitIntent={() => void submit()}
              outcome={phase.name === "feedback" ? { correct: phase.result.correct, submitted: phase.submitted, correctResponse: phase.result.correctResponse } : null}
              disabled={phase.name === "feedback" || submitAttempt.isPending}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- moves focus to the new question in a single-task flow
              autoFocus
            />

            {phase.name === "question" ? (
              <>
                {hintsShown > 0 ? (
                  <ol role="list" className={styles.hints} aria-live="polite">
                    {phase.data.item.hints.slice(0, hintsShown).map((hint, index) => (
                      <motion.li key={index} className={styles.hint} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                        <LightbulbIcon size={16} />
                        <span>
                          <strong>{t("practice.hintLabel", { number: index + 1 })}</strong> {hint}
                        </span>
                      </motion.li>
                    ))}
                  </ol>
                ) : null}

                <AnimatePresence>
                  {nudge ? (
                    <motion.p className={styles.nudge} role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      {nudge}
                    </motion.p>
                  ) : null}
                </AnimatePresence>

                <div className={styles.actions}>
                  <Button
                    variant="ghost"
                    leadingIcon={LightbulbIcon}
                    disabled={hintsShown >= phase.data.item.hints.length}
                    onClick={() => setHintsShown((n) => n + 1)}
                  >
                    {hintsShown >= phase.data.item.hints.length && hintsShown > 0
                      ? t("practice.noMoreHints")
                      : hintsShown === 0
                        ? t("practice.hint")
                        : t("practice.anotherHint")}
                  </Button>
                  <div className={styles.checkWrap}>
                    <span className={styles.kbdHint} aria-hidden="true">
                      {t("practice.enterToCheck")}
                    </span>
                    <Button type="submit" size="lg" loading={submitAttempt.isPending}>
                      {t("practice.check")}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <FeedbackPanel
                correct={phase.result.correct}
                encouragementKey={phase.result.encouragementKey}
                values={{
                  count: streak.current,
                  skill: skillNames.get(phase.data.item.skillId) ?? "",
                  level: progress.data ? levelForXp(progress.data.totalXp).level : 1,
                }}
                explanation={phase.result.explanation}
                correctAnswer={phase.result.correct ? undefined : describeResponse(phase.data.item, phase.result.correctResponse)}
                xpEarned={phase.result.xpEarned}
                continueLabel={answered >= target ? t("practice.finish") : t("practice.next")}
                onContinue={celebrate === null ? () => void (answered >= target ? finish() : advance()) : undefined}
              />
            )}
          </motion.form>
        ) : null}

        {phase.name === "summary" ? (
          <motion.div key="summary" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            <SessionSummary
              answered={phase.answered}
              correct={phase.correct}
              xpEarned={phase.xpEarned}
              deltas={[...deltas.current.values()]}
              skillNames={skillNames}
              onAgain={() => void begin()}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <MasteryCelebration open={celebrate !== null} skillName={celebrate ?? ""} onClose={() => setCelebrate(null)} />

      <Dialog
        open={leaving}
        onClose={() => setLeaving(false)}
        size="sm"
        title={t("practice.leaveTitle")}
        description={t("practice.leaveBody")}
        footer={
          <>
            <Button variant="secondary" onClick={() => navigate("/home")}>
              {t("practice.leaveConfirm")}
            </Button>
            <Button onClick={() => setLeaving(false)}>{t("practice.keepGoing")}</Button>
          </>
        }
      />
    </div>
  );
}

const BAND_TONE = { new: "neutral", learning: "accent", practicing: "primary", mastered: "success" } as const;

function SessionSummary({
  answered,
  correct,
  xpEarned,
  deltas,
  skillNames,
  onAgain,
}: {
  answered: number;
  correct: number;
  xpEarned: number;
  deltas: SkillDelta[];
  skillNames: Map<string, string>;
  onAgain: () => void;
}) {
  const { t, formatNumber } = useT();
  const accuracy = answered === 0 ? 0 : correct / answered;
  const heading = accuracy >= 0.85 ? t("practice.summary.great") : accuracy >= 0.6 ? t("practice.summary.good") : t("practice.summary.growing");

  return (
    <Card padding="lg" className={styles.summary}>
      <div className={styles.summaryHero}>
        <ProgressRing value={accuracy} size={132} thickness={12} tone={accuracy >= 0.6 ? "success" : "accent"} label={t("practice.summary.accuracy")}>
          <span className={styles.summaryPercent}>{Math.round(accuracy * 100)}%</span>
          <span className={styles.summaryRingLabel}>{t("practice.summary.accuracy")}</span>
        </ProgressRing>
        <div>
          <h1 className={styles.summaryTitle}>{heading}</h1>
          <p className={styles.summaryBody}>{t("practice.summary.body", { answered, correct })}</p>
          <p className={styles.summaryXp}>
            <SparklesIcon size={18} /> {t("practice.summary.xpLine", { amount: formatNumber(xpEarned) })}
          </p>
        </div>
      </div>

      {deltas.length > 0 ? (
        <section aria-labelledby="summary-skills" className={styles.summarySkills}>
          <h2 id="summary-skills" className={styles.summarySubtitle}>
            {t("practice.summary.skills")}
          </h2>
          <ul role="list" className={styles.deltaList}>
            {deltas.map((delta) => {
              const grew = delta.after.pKnown - delta.before;
              return (
                <li key={delta.skillId} className={styles.delta}>
                  <div className={styles.deltaHead}>
                    <span className={styles.deltaName}>{skillNames.get(delta.skillId) ?? ""}</span>
                    <Badge size="sm" tone={BAND_TONE[delta.after.band]}>
                      {t(`mastery.${delta.after.band}`)}
                    </Badge>
                  </div>
                  <div className={styles.deltaBar} aria-hidden="true">
                    <span className={styles.deltaBefore} style={{ width: `${Math.round(Math.min(delta.before, delta.after.pKnown) * 100)}%` }} />
                    <motion.span
                      className={cx(styles.deltaAfter, grew < 0 && styles.deltaDip)}
                      initial={{ width: `${Math.round(delta.before * 100)}%` }}
                      animate={{ width: `${Math.round(delta.after.pKnown * 100)}%` }}
                      transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <span className="sr-only">
                    {t("practice.summary.skillChange", { before: Math.round(delta.before * 100), after: Math.round(delta.after.pKnown * 100) })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className={styles.summaryActions}>
        <Button size="lg" leadingIcon={RefreshIcon} onClick={onAgain}>
          {t("practice.summary.again")}
        </Button>
        <ButtonLink to="/progress" size="lg" variant="secondary" leadingIcon={ChartIcon}>
          {t("practice.summary.progress")}
        </ButtonLink>
        <ButtonLink to="/home" size="lg" variant="ghost" leadingIcon={HomeIcon}>
          {t("practice.summary.home")}
        </ButtonLink>
      </div>
      <Banner tone="primary" className={styles.summaryBanner}>
        {t("practice.summary.nextTime")}
      </Banner>
    </Card>
  );
}
