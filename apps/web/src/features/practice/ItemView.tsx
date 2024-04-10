import type { PublicItem, Response } from "@learnly/shared";
import { motion } from "framer-motion";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { useT } from "../../i18n/I18nProvider";
import { Input, cx } from "../../ui/components";
import { CheckIcon, CloseIcon } from "../../ui/icons";
import { OrderingInput } from "./OrderingInput";
import type { Draft } from "./responses";
import styles from "./Practice.module.css";

export interface ItemOutcome {
  correct: boolean;
  submitted: Response;
  correctResponse: Response;
}

export interface ItemViewProps {
  item: PublicItem;
  draft: Draft;
  onDraftChange: (draft: Draft) => void;
  /** Called when the learner presses Enter on a choice (forms handle text inputs). */
  onSubmitIntent?: () => void;
  outcome?: ItemOutcome | null;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Smaller prompt for inline lesson checks. */
  compact?: boolean;
}

const LETTERS = "ABCDEFGH";

function orderingMarks(order: string[], correct: string[]): Record<string, "right" | "wrong"> {
  const marks: Record<string, "right" | "wrong"> = {};
  order.forEach((id, index) => {
    marks[id] = correct[index] === id ? "right" : "wrong";
  });
  return marks;
}

function MultipleChoice({
  item,
  draft,
  onDraftChange,
  onSubmitIntent,
  outcome,
  disabled,
  autoFocus,
  labelledBy,
}: Omit<ItemViewProps, "item" | "draft"> & {
  item: Extract<PublicItem, { kind: "multiple_choice" }>;
  draft: Extract<Draft, { kind: "multiple_choice" }>;
  labelledBy: string;
}) {
  const name = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const correctId = outcome?.correctResponse.kind === "multiple_choice" ? outcome.correctResponse.choiceId : null;

  useEffect(() => {
    if (autoFocus) groupRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, [autoFocus, item.id]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const index = LETTERS.indexOf(event.key.toUpperCase());
    const numeric = Number(event.key) - 1;
    const pick = index >= 0 && index < item.choices.length ? index : numeric >= 0 && numeric < item.choices.length ? numeric : -1;
    const choice = item.choices[pick];
    if (choice && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      onDraftChange({ kind: "multiple_choice", choiceId: choice.id });
      groupRef.current?.querySelectorAll<HTMLInputElement>("input")[pick]?.focus();
    } else if (event.key === "Enter" && draft.choiceId) {
      event.preventDefault();
      onSubmitIntent?.();
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tabindex: the selected child is the tab stop
    <div ref={groupRef} role="radiogroup" aria-labelledby={labelledBy} className={styles.choices} onKeyDown={onKeyDown}>
      {item.choices.map((choice, index) => {
        const selected = draft.choiceId === choice.id;
        const isCorrect = outcome && correctId === choice.id;
        const isWrong = outcome && selected && !outcome.correct;
        return (
          <motion.label
            key={choice.id}
            className={cx(styles.choice, selected && styles.choiceSelected, isCorrect && styles.choiceRight, isWrong && styles.choiceWrong, disabled && styles.choiceDisabled)}
            initial={{ opacity: 0, y: 8 }}
            animate={isWrong ? { opacity: 1, y: 0, x: [0, -6, 6, -3, 3, 0] } : { opacity: 1, y: 0 }}
            transition={{ delay: outcome ? 0 : index * 0.04, duration: isWrong ? 0.4 : 0.25 }}
          >
            <input
              type="radio"
              className={styles.choiceInput}
              name={name}
              value={choice.id}
              checked={selected}
              disabled={disabled}
              onChange={() => onDraftChange({ kind: "multiple_choice", choiceId: choice.id })}
            />
            <span className={styles.choiceLetter} aria-hidden="true">
              {isCorrect ? <CheckIcon size={16} /> : isWrong ? <CloseIcon size={16} /> : LETTERS[index]}
            </span>
            <span className={styles.choiceText}>{choice.text}</span>
          </motion.label>
        );
      })}
    </div>
  );
}

/** Renders any practice item and reports draft changes; the parent owns submission. */
export function ItemView({ item, draft, onDraftChange, onSubmitIntent, outcome, disabled, autoFocus, compact }: ItemViewProps) {
  const { t } = useT();
  const promptId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && (item.kind === "numeric" || item.kind === "short_text")) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus, item.id, item.kind]);

  const answerTone = outcome ? (outcome.correct ? styles.inputRight : styles.inputWrong) : undefined;

  return (
    <div className={cx(styles.item, compact && styles.itemCompact)} role="group" aria-labelledby={promptId}>
      <p id={promptId} className={styles.prompt}>
        {item.prompt}
      </p>

      {item.kind === "multiple_choice" && draft.kind === "multiple_choice" ? (
        <MultipleChoice
          item={item}
          draft={draft}
          onDraftChange={onDraftChange}
          onSubmitIntent={onSubmitIntent}
          outcome={outcome}
          disabled={disabled}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- moves focus to the new question in a single-task flow
          autoFocus={autoFocus}
          labelledBy={promptId}
        />
      ) : null}

      {item.kind === "numeric" && draft.kind === "numeric" ? (
        <div className={styles.answerRow}>
          <Input
            ref={inputRef}
            inputSize="lg"
            className={cx(styles.answerInput, answerTone)}
            inputMode="decimal"
            autoComplete="off"
            aria-labelledby={promptId}
            placeholder={t("practice.numericPlaceholder")}
            value={draft.raw}
            disabled={disabled}
            onChange={(event) => onDraftChange({ kind: "numeric", raw: event.target.value })}
            trailing={item.unit ? <span className={styles.unit}>{item.unit}</span> : undefined}
          />
        </div>
      ) : null}

      {item.kind === "short_text" && draft.kind === "short_text" ? (
        <div className={styles.answerRow}>
          <Input
            ref={inputRef}
            inputSize="lg"
            className={cx(styles.answerInput, answerTone)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-labelledby={promptId}
            placeholder={t("practice.textPlaceholder")}
            value={draft.text}
            disabled={disabled}
            maxLength={200}
            onChange={(event) => onDraftChange({ kind: "short_text", text: event.target.value })}
          />
        </div>
      ) : null}

      {item.kind === "ordering" && draft.kind === "ordering" ? (
        <OrderingInput
          label={item.prompt}
          entries={item.entries}
          order={draft.order}
          disabled={disabled}
          onChange={(order) => onDraftChange({ kind: "ordering", order, touched: true })}
          marks={outcome?.correctResponse.kind === "ordering" ? orderingMarks(draft.order, outcome.correctResponse.order) : undefined}
        />
      ) : null}
    </div>
  );
}
