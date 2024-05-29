import type { PublicItem } from "@learnly/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { isApiError } from "../../api/client";
import { useCompleteLesson, useLesson } from "../../api/hooks";
import { useCalmMotion, useSoundEffects } from "../../hooks/preferences";
import { useT } from "../../i18n/I18nProvider";
import { Badge, Banner, Button, ButtonLink, Card, EmptyState, IconButton, ProgressBar, Skeleton } from "../../ui/components";
import { ArrowLeftIcon, ArrowRightIcon, BookIcon, ClockIcon, CloseIcon, CloudOffIcon, HomeIcon, RefreshIcon, TargetIcon } from "../../ui/icons";
import { Confetti, XpPop } from "../practice/Celebration";
import { LessonBlockView, splitIntoSteps } from "./LessonBlocks";
import styles from "./Lesson.module.css";

export function LessonPlayerPage() {
  const { lessonId } = useParams();
  const [params] = useSearchParams();
  const courseSlug = params.get("course");
  const { t } = useT();
  const navigate = useNavigate();
  const calm = useCalmMotion();
  const play = useSoundEffects();
  const lesson = useLesson(lessonId);
  const completeLesson = useCompleteLesson();

  const [revealed, setRevealed] = useState(1);
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  const [done, setDone] = useState<{ xpEarned: number } | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const stepRefs = useRef<(HTMLElement | null)[]>([]);

  const steps = useMemo(() => splitIntoSteps(lesson.data?.lesson.blocks ?? []), [lesson.data]);
  const items = useMemo(() => new Map<string, PublicItem>((lesson.data?.items ?? []).map((item) => [item.id, item])), [lesson.data]);

  useEffect(() => {
    setRevealed(1);
    setAnswered(new Set());
    setDone(null);
    startedAt.current = Date.now();
  }, [lessonId]);

  useEffect(() => {
    if (revealed <= 1) return;
    const node = stepRefs.current[revealed - 1];
    node?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    node?.focus({ preventScroll: true });
  }, [revealed, calm]);

  const exitTo = courseSlug ? `/courses/${courseSlug}` : "/home";

  if (lesson.isPending) {
    return (
      <div className={styles.page} aria-busy="true" aria-label={t("common.loading")}>
        <Skeleton height={16} width={160} />
        <Skeleton height={40} width="70%" />
        <Skeleton lines={4} />
        <Skeleton height={220} radius={20} />
      </div>
    );
  }

  if (lesson.error || !lesson.data) {
    const offline = isApiError(lesson.error, "network");
    return (
      <EmptyState
        icon={offline ? CloudOffIcon : BookIcon}
        title={offline ? t("lesson.offlineTitle") : t("lesson.missingTitle")}
        description={offline ? t("lesson.offlineBody") : t("lesson.missingBody")}
        action={
          offline ? (
            <Button leadingIcon={RefreshIcon} onClick={() => void lesson.refetch()}>
              {t("common.retry")}
            </Button>
          ) : (
            <ButtonLink to={exitTo} variant="secondary" leadingIcon={ArrowLeftIcon}>
              {t("common.back")}
            </ButtonLink>
          )
        }
      />
    );
  }

  const { lesson: data } = lesson.data;
  const currentStep = steps[revealed - 1] ?? [];
  const pendingCheck = currentStep.some((block) => block.kind === "check" && items.has(block.itemId) && !answered.has(block.itemId));
  const isLast = revealed >= steps.length;

  async function finish() {
    setFinishError(null);
    try {
      const result = await completeLesson.mutateAsync({ lessonId: data.id, durationMs: Date.now() - startedAt.current });
      setDone({ xpEarned: result.xpEarned });
      play("levelUp");
    } catch (error) {
      setFinishError(isApiError(error, "network") ? t("lesson.finishOffline") : t("lesson.finishError"));
    }
  }

  if (done) {
    return (
      <motion.div className={styles.complete} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
        <Confetti pieces={28} />
        <Card padding="lg" className={styles.completeCard}>
          <div className={styles.completeBadge}>
            <BookIcon size={40} />
          </div>
          <p className="eyebrow">{t("lesson.complete.eyebrow")}</p>
          <h1 className={styles.completeTitle}>{t("lesson.complete.title")}</h1>
          <p className={styles.completeBody}>{t("lesson.complete.body", { title: data.title })}</p>
          <div className={styles.completeXp}>
            <XpPop amount={done.xpEarned} />
          </div>
          <div className={styles.completeActions}>
            {courseSlug ? (
              <ButtonLink to={`/practice/${courseSlug}`} size="lg" leadingIcon={TargetIcon} trailingIcon={ArrowRightIcon}>
                {t("lesson.complete.practice")}
              </ButtonLink>
            ) : null}
            <ButtonLink to={courseSlug ? `/courses/${courseSlug}` : "/courses"} size="lg" variant="secondary" leadingIcon={BookIcon}>
              {t("lesson.complete.course")}
            </ButtonLink>
            <ButtonLink to="/home" size="lg" variant="ghost" leadingIcon={HomeIcon}>
              {t("common.home")}
            </ButtonLink>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <IconButton icon={CloseIcon} label={t("lesson.exit")} onClick={() => navigate(exitTo)} />
        <ProgressBar value={revealed / Math.max(1, steps.length)} label={t("lesson.progress", { current: revealed, total: steps.length })} size="sm" className={styles.topProgress} />
        <span className={styles.topCount} aria-hidden="true">
          {revealed}/{steps.length}
        </span>
      </header>

      <article className={styles.article} data-lesson-ready={lessonId}>
        <header className={styles.lessonHeader}>
          <div className={styles.lessonMeta}>
            <Badge tone="primary" size="sm">
              {t("lesson.level", { level: data.level })}
            </Badge>
            <span className={styles.minutes}>
              <ClockIcon size={14} /> {t("common.minutes", { count: data.estimatedMinutes })}
            </span>
          </div>
          <h1 className={styles.title} data-route-focus="" tabIndex={-1}>
            {data.title}
          </h1>
        </header>

        {steps.slice(0, revealed).map((step, index) => (
          <motion.section
            key={index}
            ref={(node: HTMLElement | null) => {
              stepRefs.current[index] = node;
            }}
            tabIndex={-1}
            className={styles.stepSection}
            aria-label={t("lesson.stepLabel", { current: index + 1, total: steps.length })}
            initial={index === 0 ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {step.map((block, blockIndex) => (
              <LessonBlockView
                key={blockIndex}
                block={block}
                items={items}
                onCheckAnswered={(itemId) => setAnswered((current) => new Set(current).add(itemId))}
              />
            ))}
          </motion.section>
        ))}

        <div className={styles.pacer}>
          <AnimatePresence>
            {finishError ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Banner tone="warning" role="alert">
                  {finishError}
                </Banner>
              </motion.div>
            ) : null}
          </AnimatePresence>
          {pendingCheck ? <p className={styles.pacerHint}>{t("lesson.answerToContinue")}</p> : null}
          {isLast ? (
            <Button size="lg" trailingIcon={ArrowRightIcon} disabled={pendingCheck} loading={completeLesson.isPending} onClick={() => void finish()}>
              {t("lesson.finish")}
            </Button>
          ) : (
            <Button size="lg" trailingIcon={ArrowRightIcon} disabled={pendingCheck} onClick={() => setRevealed((n) => Math.min(steps.length, n + 1))}>
              {t("common.continue")}
            </Button>
          )}
        </div>
      </article>
    </div>
  );
}
