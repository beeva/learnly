import { ENCOURAGEMENT, type EncouragementKey } from "@learnly/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { t as translate, useT, type MessageKey, type MessageValues } from "../../i18n/I18nProvider";
import { Button, cx } from "../../ui/components";
import { ArrowRightIcon, ChevronDownIcon, HeartIcon, LightbulbIcon, SparklesIcon } from "../../ui/icons";
import { XpPop } from "./Celebration";
import styles from "./Practice.module.css";

function isEncouragementKey(key: string): key is EncouragementKey {
  return Object.prototype.hasOwnProperty.call(ENCOURAGEMENT, key);
}

/** Localized encouragement for a key sent by the API, with a sensible fallback. */
export function encouragementText(key: string, correct: boolean, values: MessageValues): string {
  const safe: EncouragementKey = isEncouragementKey(key) ? key : correct ? "correct" : "incorrect_first";
  return translate(`encouragement.${safe}` as MessageKey, values);
}

export interface FeedbackPanelProps {
  correct: boolean;
  encouragementKey: string;
  values: MessageValues;
  explanation: string;
  /** Shown when the answer wasn't right: "The answer is 3/4". */
  correctAnswer?: string;
  xpEarned: number;
  onContinue?: () => void;
  continueLabel?: string;
  compact?: boolean;
}

/**
 * Feedback after an answer. Always explains, never scolds: "not yet" uses warm
 * coral rather than red, and the explanation is one tap away.
 */
export function FeedbackPanel({ correct, encouragementKey, values, explanation, correctAnswer, xpEarned, onContinue, continueLabel, compact }: FeedbackPanelProps) {
  const { t } = useT();
  const [showWhy, setShowWhy] = useState(!correct);
  const continueRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const canContinue = Boolean(onContinue);
  useEffect(() => {
    if (canContinue) continueRef.current?.focus({ preventScroll: true });
  }, [canContinue]);

  const Icon = correct ? SparklesIcon : HeartIcon;

  return (
    <motion.section
      className={cx(styles.feedback, correct ? styles.feedbackRight : styles.feedbackTry, compact && styles.feedbackCompact)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
      aria-labelledby={titleId}
    >
      <div className={styles.feedbackHead}>
        <motion.span
          className={styles.feedbackIcon}
          initial={{ scale: 0.4, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.05 }}
        >
          <Icon size={22} />
        </motion.span>
        <div className={styles.feedbackText} role="status" aria-live="polite">
          <p id={titleId} className={styles.feedbackTitle}>
            {encouragementText(encouragementKey, correct, values)}
          </p>
          {!correct && correctAnswer ? (
            <p className={styles.feedbackAnswer}>
              {t("practice.feedback.answerWas")} <strong>{correctAnswer}</strong>
            </p>
          ) : null}
        </div>
        <XpPop key={`${encouragementKey}-${xpEarned}`} amount={xpEarned} />
      </div>

      {explanation ? (
        <div className={styles.why}>
          <button type="button" className={styles.whyToggle} aria-expanded={showWhy} onClick={() => setShowWhy((v) => !v)}>
            <LightbulbIcon size={16} />
            {correct ? t("practice.feedback.why") : t("practice.feedback.howItWorks")}
            <ChevronDownIcon size={16} className={cx(styles.whyChevron, showWhy && styles.whyChevronOpen)} />
          </button>
          <AnimatePresence initial={false}>
            {showWhy ? (
              <motion.p
                className={styles.whyBody}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                {explanation}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}

      {onContinue ? (
        <div className={styles.feedbackActions}>
          <Button ref={continueRef} size="lg" variant={correct ? "primary" : "secondary"} trailingIcon={ArrowRightIcon} onClick={onContinue}>
            {continueLabel ?? t("common.continue")}
          </Button>
        </div>
      ) : null}
    </motion.section>
  );
}
