import type { DiagnosticSummary, NextItemResponse } from "@learnly/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isApiError } from "../../api/client";
import { useCompleteSession, useCourse, useCourses, useNextItem, useStartSession, useSubmitAttempt, useUpdatePreferences } from "../../api/hooks";
import { useAuth } from "../../auth/AuthProvider";
import { useT } from "../../i18n/I18nProvider";
import { CourseCover } from "../../pages/Courses";
import { Button, ButtonLink, Card, ChoiceGroup, EmptyState, IconButton, Skeleton, Spinner, cx } from "../../ui/components";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChartIcon,
  CheckIcon,
  CloseIcon,
  CompassIcon,
  HeartIcon,
  LayersIcon,
  PlayIcon,
  RefreshIcon,
  SparklesIcon,
  TargetIcon,
} from "../../ui/icons";
import { ItemView } from "../practice/ItemView";
import { draftProblem, emptyDraft, toResponse, type Draft } from "../practice/responses";
import styles from "./Diagnostic.module.css";

const DIAGNOSTIC_ITEMS = 6;

function StepDots({ total, current, label }: { total: number; current: number; label: string }) {
  return (
    <div className={styles.stepDots} role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1}>
      {Array.from({ length: total }, (_, i) => (
        <motion.span key={i} className={cx(styles.stepDot, i < current && styles.stepDotDone, i === current && styles.stepDotCurrent)} layout transition={{ type: "spring", stiffness: 400, damping: 30 }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- welcome */

type GoalValue = "5" | "10" | "15" | "20";

export function WelcomePage() {
  const { t } = useT();
  const { user, preferences } = useAuth();
  const navigate = useNavigate();
  const courses = useCourses();
  const updatePreferences = useUpdatePreferences();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GoalValue>(() => {
    const current = String(preferences?.dailyGoalMinutes ?? 10);
    return current === "5" || current === "10" || current === "15" || current === "20" ? current : "10";
  });
  const [courseSlug, setCourseSlug] = useState<string | null>(null);

  const suggested = useMemo(() => {
    const list = courses.data?.courses ?? [];
    const matching = list.filter((course) => course.gradeBand === user?.gradeBand);
    return matching.length > 0 ? matching : list;
  }, [courses.data, user?.gradeBand]);

  const selected = courseSlug ?? suggested[0]?.slug ?? null;
  const firstName = user?.displayName.split(" ")[0] ?? "";
  const total = 3;

  function next() {
    if (step === 1) updatePreferences.mutate({ dailyGoalMinutes: Number(goal) });
    if (step < total - 1) setStep(step + 1);
    else if (selected) navigate(`/assess/${selected}`);
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <IconButton icon={step === 0 ? CloseIcon : ArrowLeftIcon} label={step === 0 ? t("welcome.skip") : t("common.back")} onClick={() => (step === 0 ? navigate("/home") : setStep(step - 1))} />
        <StepDots total={total} current={step} label={t("welcome.stepOf", { current: step + 1, total })} />
        <span />
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className={styles.panel}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
        >
          {step === 0 ? (
            <>
              <div className={styles.hello} aria-hidden="true">
                <span className={styles.helloWave}>
                  <SparklesIcon size={36} />
                </span>
              </div>
              <h1 className={styles.title} data-route-focus="" tabIndex={-1}>
                {t("welcome.hello", { name: firstName })}
              </h1>
              <p className={styles.lead}>{t("welcome.intro")}</p>
              <ul role="list" className={styles.pillars}>
                {(
                  [
                    [CompassIcon, "welcome.pillar.assess"],
                    [LayersIcon, "welcome.pillar.learn"],
                    [TargetIcon, "welcome.pillar.practice"],
                    [ChartIcon, "welcome.pillar.progress"],
                  ] as const
                ).map(([Icon, key]) => (
                  <li key={key} className={styles.pillar}>
                    <span className={styles.pillarIcon}>
                      <Icon size={20} />
                    </span>
                    {t(key)}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h1 className={styles.title}>{t("welcome.goalTitle")}</h1>
              <p className={styles.lead}>{t("welcome.goalBody")}</p>
              <ChoiceGroup<GoalValue>
                legend={t("welcome.goalLegend")}
                hideLegend
                name="daily-goal"
                value={goal}
                onChange={setGoal}
                columns={2}
                options={[
                  { value: "5", label: t("goal.5.label"), description: t("goal.5.description") },
                  { value: "10", label: t("goal.10.label"), description: t("goal.10.description") },
                  { value: "15", label: t("goal.15.label"), description: t("goal.15.description") },
                  { value: "20", label: t("goal.20.label"), description: t("goal.20.description") },
                ]}
              />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h1 className={styles.title}>{t("welcome.courseTitle")}</h1>
              <p className={styles.lead}>{t("welcome.courseBody")}</p>
              {courses.isPending ? (
                <div className={styles.courseGrid}>
                  <Skeleton height={120} radius={16} />
                  <Skeleton height={120} radius={16} />
                </div>
              ) : (
                <div className={styles.courseGrid} role="radiogroup" aria-label={t("welcome.courseTitle")}>
                  {suggested.map((course) => {
                    const checked = selected === course.slug;
                    return (
                      <button
                        key={course.id}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        className={cx(styles.courseOption, checked && styles.courseOptionChecked)}
                        onClick={() => setCourseSlug(course.slug)}
                      >
                        <CourseCover course={course} size="sm" />
                        <span className={styles.courseOptionBody}>
                          <span className={styles.courseOptionTitle}>{course.title}</span>
                          <span className={styles.courseOptionMeta}>{t("welcome.courseMeta", { units: course.unitCount })}</span>
                        </span>
                        {checked ? (
                          <span className={styles.courseCheck} aria-hidden="true">
                            <CheckIcon size={14} />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className={styles.reassure}>
                <HeartIcon size={16} /> {t("welcome.reassure")}
              </p>
            </>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <footer className={styles.footer}>
        <Button size="lg" block trailingIcon={ArrowRightIcon} disabled={step === 2 && !selected} onClick={next}>
          {step === 0 ? t("welcome.letsGo") : step === 1 ? t("common.continue") : t("welcome.startCheckIn")}
        </Button>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------- diagnostic */

type DiagnosticPhase =
  | { name: "intro" }
  | { name: "loading" }
  | { name: "question"; data: NextItemResponse; shownAt: number }
  | { name: "thanks"; answered: number; target: number }
  | { name: "summary"; summary: DiagnosticSummary | null; xpEarned: number }
  | { name: "error"; offline: boolean; retry: () => void };

type Bucket = "strong" | "growing" | "starting";

function bucketOf(pKnown: number): Bucket {
  if (pKnown >= 0.6) return "strong";
  if (pKnown >= 0.35) return "growing";
  return "starting";
}

export function DiagnosticPage() {
  const { courseSlug } = useParams();
  const { t } = useT();
  const navigate = useNavigate();
  const course = useCourse(courseSlug);
  const startSession = useStartSession();
  const nextItem = useNextItem();
  const submitAttempt = useSubmitAttempt();
  const completeSession = useCompleteSession();
  const [phase, setPhase] = useState<DiagnosticPhase>({ name: "intro" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  const sessionId = useRef<string | null>(null);

  function show(data: NextItemResponse): boolean {
    if (!data.item) return false;
    setDraft(emptyDraft(data.item));
    setNudge(null);
    setPhase({ name: "question", data, shownAt: performance.now() });
    return true;
  }

  async function finish() {
    if (!sessionId.current) return;
    setPhase({ name: "loading" });
    try {
      const result = await completeSession.mutateAsync(sessionId.current);
      setPhase({ name: "summary", summary: result.summary ?? null, xpEarned: result.xpEarned });
    } catch (error) {
      setPhase({ name: "error", offline: isApiError(error, "network"), retry: () => void finish() });
    }
  }

  async function begin() {
    if (!course.data) return;
    setPhase({ name: "loading" });
    try {
      const data = await startSession.mutateAsync({ courseId: course.data.course.id, kind: "diagnostic", targetItems: DIAGNOSTIC_ITEMS });
      sessionId.current = data.session.id;
      if (!show(data)) await finish();
    } catch (error) {
      setPhase({ name: "error", offline: isApiError(error, "network"), retry: () => void begin() });
    }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (phase.name !== "question" || !draft || !phase.data.item) return;
    const response = toResponse(draft);
    if (!response) {
      const problem = draftProblem(draft);
      setNudge(problem ? t(`practice.nudge.${problem}`) : null);
      return;
    }
    const { data } = phase;
    const item = data.item;
    if (!item) return;
    try {
      await submitAttempt.mutateAsync({
        itemId: item.id,
        sessionId: data.session.id,
        response,
        hintsUsed: 0,
        durationMs: Math.round(performance.now() - phase.shownAt),
        clientAttemptId: crypto.randomUUID(),
        answeredAt: new Date().toISOString(),
      });
      const answered = data.progress.answered + 1;
      // A short, calm beat between questions — no right/wrong, just "got it".
      setPhase({ name: "thanks", answered, target: data.progress.target });
      const [next] = await Promise.all([answered >= data.progress.target ? null : nextItem.mutateAsync(data.session.id), new Promise((resolve) => setTimeout(resolve, 650))]);
      if (!next || !show(next)) await finish();
    } catch (error) {
      setNudge(isApiError(error, "network") ? t("practice.offline") : t("practice.error"));
      setPhase(phase);
    }
  }

  if (course.isPending) {
    return (
      <div className={styles.page} aria-busy="true">
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

  const answered = phase.name === "question" ? phase.data.progress.answered : phase.name === "thanks" ? phase.answered : 0;
  const target = phase.name === "question" ? phase.data.progress.target : phase.name === "thanks" ? phase.target : DIAGNOSTIC_ITEMS;
  const inFlow = phase.name === "question" || phase.name === "thanks" || phase.name === "loading";
  const slug = course.data.course.slug;

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <IconButton icon={CloseIcon} label={t("assess.leave")} onClick={() => navigate(`/courses/${slug}`)} />
        {inFlow ? <StepDots total={target} current={Math.min(answered, target - 1)} label={t("assess.progress", { current: Math.min(answered + 1, target), total: target })} /> : <span />}
        <span />
      </header>

      <AnimatePresence mode="wait">
        {phase.name === "intro" ? (
          <motion.div key="intro" className={styles.panel} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className={styles.calmArt} aria-hidden="true">
              <span className={styles.calmRing} />
              <span className={styles.calmRing} />
              <CompassIcon size={40} />
            </div>
            <p className="eyebrow">{course.data.course.title}</p>
            <h1 className={styles.title} data-route-focus="" tabIndex={-1}>
              {t("assess.introTitle")}
            </h1>
            <p className={styles.lead}>{t("assess.introBody", { count: DIAGNOSTIC_ITEMS })}</p>
            <ul role="list" className={styles.promises}>
              <li>
                <CheckIcon size={16} /> {t("assess.promise.noScores")}
              </li>
              <li>
                <CheckIcon size={16} /> {t("assess.promise.guess")}
              </li>
              <li>
                <CheckIcon size={16} /> {t("assess.promise.time")}
              </li>
            </ul>
            <Button size="lg" trailingIcon={ArrowRightIcon} loading={startSession.isPending} onClick={() => void begin()}>
              {t("assess.begin")}
            </Button>
          </motion.div>
        ) : null}

        {phase.name === "loading" ? (
          <motion.div key="loading" className={styles.center} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status">
            <Spinner size={28} label={t("common.loading")} />
          </motion.div>
        ) : null}

        {phase.name === "thanks" ? (
          <motion.div key={`thanks-${phase.answered}`} className={styles.center} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} role="status">
            <span className={styles.thanksIcon}>
              <CheckIcon size={28} />
            </span>
            <p className={styles.thanksText}>{phase.answered >= phase.target ? t("assess.allDone") : t(`assess.thanks.${(phase.answered % 3) as 0 | 1 | 2}`)}</p>
          </motion.div>
        ) : null}

        {phase.name === "question" && phase.data.item && draft ? (
          <motion.form
            key={phase.data.item.id}
            className={styles.questionCard}
            onSubmit={(event) => void submit(event)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            noValidate
          >
            <ItemView
              item={phase.data.item}
              draft={draft}
              onDraftChange={(next) => {
                setDraft(next);
                setNudge(null);
              }}
              onSubmitIntent={() => void submit()}
              disabled={submitAttempt.isPending}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- moves focus to the new question in a single-task flow
              autoFocus
            />
            {nudge ? (
              <p className={styles.nudge} role="alert">
                {nudge}
              </p>
            ) : null}
            <div className={styles.questionFooter}>
              <p className={styles.guessNote}>
                <SparklesIcon size={16} /> {t("assess.guessNote")}
              </p>
              <Button type="submit" size="lg" loading={submitAttempt.isPending}>
                {t("assess.next")}
              </Button>
            </div>
          </motion.form>
        ) : null}

        {phase.name === "error" ? (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmptyState
              icon={RefreshIcon}
              title={phase.offline ? t("practice.offlineTitle") : t("practice.error")}
              description={phase.offline ? t("practice.offline") : undefined}
              action={<Button onClick={phase.retry}>{t("common.retry")}</Button>}
            />
          </motion.div>
        ) : null}

        {phase.name === "summary" ? (
          <motion.div key="summary" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <StartingPoints summary={phase.summary} xpEarned={phase.xpEarned} courseSlug={slug} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const BUCKET_ORDER: Bucket[] = ["strong", "growing", "starting"];

function StartingPoints({ summary, xpEarned, courseSlug }: { summary: DiagnosticSummary | null; xpEarned: number; courseSlug: string }) {
  const { t } = useT();
  const groups = useMemo(() => {
    const map = new Map<Bucket, string[]>();
    for (const point of summary?.startingPoints ?? []) {
      const bucket = bucketOf(point.pKnown);
      map.set(bucket, [...(map.get(bucket) ?? []), point.skillName]);
    }
    return BUCKET_ORDER.map((bucket) => ({ bucket, skills: map.get(bucket) ?? [] })).filter((group) => group.skills.length > 0);
  }, [summary]);

  return (
    <Card padding="lg" className={styles.summary}>
      <div className={styles.summaryHead}>
        <span className={styles.summaryIcon} aria-hidden="true">
          <SparklesIcon size={28} />
        </span>
        <div>
          <h1 className={styles.title} data-route-focus="" tabIndex={-1}>
            {t("assess.summaryTitle")}
          </h1>
          <p className={styles.lead}>{t("assess.summaryBody")}</p>
        </div>
      </div>

      <ul role="list" className={styles.buckets}>
        {groups.map((group, index) => (
          <motion.li
            key={group.bucket}
            className={cx(styles.bucket, styles[`bucket-${group.bucket}`])}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.1 }}
          >
            <p className={styles.bucketTitle}>{t(`assess.bucket.${group.bucket}`)}</p>
            <p className={styles.bucketBody}>{t(`assess.bucket.${group.bucket}.body`)}</p>
            <ul role="list" className={styles.bucketSkills}>
              {group.skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </motion.li>
        ))}
      </ul>

      {xpEarned > 0 ? <p className={styles.xpNote}>{t("assess.xp", { amount: xpEarned })}</p> : null}

      <div className={styles.summaryActions}>
        {summary?.recommendedLessonId ? (
          <ButtonLink to={`/lessons/${summary.recommendedLessonId}?course=${courseSlug}`} size="lg" leadingIcon={PlayIcon} trailingIcon={ArrowRightIcon}>
            {t("assess.startLesson")}
          </ButtonLink>
        ) : null}
        <ButtonLink to="/home" size="lg" variant="secondary">
          {t("assess.toHome")}
        </ButtonLink>
      </div>
    </Card>
  );
}
