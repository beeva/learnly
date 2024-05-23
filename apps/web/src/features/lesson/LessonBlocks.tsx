import type { AttemptResult, LessonBlock, PublicItem } from "@learnly/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { isApiError } from "../../api/client";
import { useSubmitAttempt } from "../../api/hooks";
import { useT } from "../../i18n/I18nProvider";
import { Button, cx } from "../../ui/components";
import { BookIcon, CheckIcon, ChevronDownIcon, LightbulbIcon, SparklesIcon, TargetIcon, type IconComponent } from "../../ui/icons";
import { FeedbackPanel } from "../practice/FeedbackPanel";
import { ItemView } from "../practice/ItemView";
import { describeResponse, draftProblem, emptyDraft, toResponse, type Draft } from "../practice/responses";
import styles from "./Lesson.module.css";

type CalloutTone = Extract<LessonBlock, { kind: "callout" }>["tone"];

const CALLOUT_ICON: Record<CalloutTone, IconComponent> = { tip: LightbulbIcon, remember: BookIcon, try: TargetIcon };

/** Worked example: the learner reveals one step at a time, then the answer. */
export function WorkedExample({ block }: { block: Extract<LessonBlock, { kind: "example" }> }) {
  const { t } = useT();
  const [shown, setShown] = useState(0);
  const [answerShown, setAnswerShown] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const allSteps = shown >= block.steps.length;

  useEffect(() => {
    if (shown === 0) return;
    listRef.current?.querySelectorAll<HTMLElement>("li")[shown - 1]?.focus({ preventScroll: false });
  }, [shown]);

  return (
    <section className={styles.example} aria-label={t("lesson.example.label")}>
      <p className={styles.exampleEyebrow}>
        <SparklesIcon size={16} /> {t("lesson.example.label")}
      </p>
      <p className={styles.examplePrompt}>{block.prompt}</p>
      <ol ref={listRef} className={styles.steps} aria-live="polite">
        <AnimatePresence initial={false}>
          {block.steps.slice(0, shown).map((step, index) => (
            <motion.li
              key={index}
              tabIndex={-1}
              className={styles.step}
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span>{step}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <AnimatePresence>
        {answerShown ? (
          <motion.p className={styles.exampleAnswer} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} role="status">
            <CheckIcon size={18} /> {block.answer}
          </motion.p>
        ) : null}
      </AnimatePresence>
      {!answerShown ? (
        <div className={styles.exampleActions}>
          {!allSteps ? (
            <Button variant="secondary" size="sm" trailingIcon={ChevronDownIcon} onClick={() => setShown((n) => n + 1)}>
              {shown === 0 ? t("lesson.example.firstStep") : t("lesson.example.nextStep", { current: shown + 1, total: block.steps.length })}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" leadingIcon={CheckIcon} onClick={() => setAnswerShown(true)}>
              {t("lesson.example.showAnswer")}
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** An inline check: a single practice item answered inside the lesson. */
export function CheckBlock({ item, onAnswered }: { item: PublicItem; onAnswered: (correct: boolean) => void }) {
  const { t } = useT();
  const submitAttempt = useSubmitAttempt();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(item));
  const [result, setResult] = useState<{ attempt: AttemptResult; response: NonNullable<ReturnType<typeof toResponse>> } | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  const shownAt = useRef(performance.now());

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (result || submitAttempt.isPending) return;
    const response = toResponse(draft);
    if (!response) {
      const problem = draftProblem(draft);
      setNudge(problem ? t(`practice.nudge.${problem}`) : null);
      return;
    }
    try {
      const attempt = await submitAttempt.mutateAsync({
        itemId: item.id,
        sessionId: null,
        response,
        hintsUsed: 0,
        durationMs: Math.round(performance.now() - shownAt.current),
        clientAttemptId: crypto.randomUUID(),
        answeredAt: new Date().toISOString(),
      });
      setResult({ attempt, response });
      onAnswered(attempt.correct);
    } catch (error) {
      setNudge(isApiError(error, "network") ? t("lesson.check.offline") : t("practice.error"));
    }
  }

  return (
    <form className={styles.check} onSubmit={(event) => void submit(event)} noValidate>
      <p className={styles.checkEyebrow}>
        <TargetIcon size={16} /> {t("lesson.check.label")}
      </p>
      <ItemView
        item={item}
        draft={draft}
        compact
        onDraftChange={(next) => {
          setDraft(next);
          setNudge(null);
        }}
        onSubmitIntent={() => void submit()}
        disabled={Boolean(result) || submitAttempt.isPending}
        outcome={result ? { correct: result.attempt.correct, submitted: result.response, correctResponse: result.attempt.correctResponse } : null}
      />
      {nudge ? (
        <p className={styles.nudge} role="alert">
          {nudge}
        </p>
      ) : null}
      {result ? (
        <FeedbackPanel
          compact
          correct={result.attempt.correct}
          encouragementKey={result.attempt.encouragementKey}
          values={{ count: 1, skill: "", level: 1 }}
          explanation={result.attempt.explanation}
          correctAnswer={result.attempt.correct ? undefined : describeResponse(item, result.attempt.correctResponse)}
          xpEarned={result.attempt.xpEarned}
        />
      ) : (
        <div className={styles.checkActions}>
          <Button type="submit" loading={submitAttempt.isPending}>
            {t("practice.check")}
          </Button>
        </div>
      )}
    </form>
  );
}

export interface LessonBlockViewProps {
  block: LessonBlock;
  items: Map<string, PublicItem>;
  onCheckAnswered: (itemId: string, correct: boolean) => void;
}

export function LessonBlockView({ block, items, onCheckAnswered }: LessonBlockViewProps) {
  const { t } = useT();
  switch (block.kind) {
    case "heading":
      return <h2 className={styles.heading}>{block.text}</h2>;
    case "paragraph":
      return <p className={styles.paragraph}>{block.text}</p>;
    case "callout": {
      const Icon = CALLOUT_ICON[block.tone];
      return (
        <aside className={cx(styles.callout, styles[`callout-${block.tone}`])} aria-label={t(`lesson.callout.${block.tone}`)}>
          <span className={styles.calloutIcon}>
            <Icon size={20} />
          </span>
          <div>
            <p className={styles.calloutLabel}>{t(`lesson.callout.${block.tone}`)}</p>
            <p>{block.text}</p>
          </div>
        </aside>
      );
    }
    case "image":
      return (
        <figure className={styles.figure}>
          <img src={block.src} alt={block.alt} loading="lazy" decoding="async" className={styles.image} />
          {block.caption ? <figcaption className={styles.caption}>{block.caption}</figcaption> : null}
        </figure>
      );
    case "example":
      return <WorkedExample block={block} />;
    case "check": {
      const item = items.get(block.itemId);
      if (!item) return null;
      return <CheckBlock item={item} onAnswered={(correct) => onCheckAnswered(block.itemId, correct)} />;
    }
  }
}

/**
 * Group blocks into paced steps: a heading starts a new step, and a check ends
 * one — so learners always answer before the lesson moves on.
 */
export function splitIntoSteps(blocks: LessonBlock[]): LessonBlock[][] {
  const steps: LessonBlock[][] = [];
  let current: LessonBlock[] = [];
  for (const block of blocks) {
    if (block.kind === "heading" && current.length > 0) {
      steps.push(current);
      current = [];
    }
    current.push(block);
    if (block.kind === "check") {
      steps.push(current);
      current = [];
    }
  }
  if (current.length > 0) steps.push(current);
  return steps;
}
