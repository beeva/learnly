import { Reorder, useDragControls } from "framer-motion";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useT } from "../../i18n/I18nProvider";
import { cx } from "../../ui/components";
import { ChevronDownIcon, ChevronUpIcon, GripIcon } from "../../ui/icons";
import { move } from "./responses";
import styles from "./Practice.module.css";

export interface OrderingEntry {
  id: string;
  text: string;
}

export interface OrderingInputProps {
  entries: OrderingEntry[];
  order: string[];
  onChange: (order: string[]) => void;
  disabled?: boolean;
  /** Per-entry feedback after submission. */
  marks?: Record<string, "right" | "wrong">;
  label: string;
}

interface RowProps {
  entry: OrderingEntry;
  index: number;
  count: number;
  grabbed: boolean;
  disabled?: boolean;
  mark?: "right" | "wrong";
  onKeyDown: (event: KeyboardEvent<HTMLLIElement>, index: number) => void;
  onMove: (from: number, to: number) => void;
  describedBy: string;
}

function OrderingRow({ entry, index, count, grabbed, disabled, mark, onKeyDown, onMove, describedBy }: RowProps) {
  const controls = useDragControls();
  const { t } = useT();
  return (
    <Reorder.Item
      value={entry.id}
      dragListener={false}
      dragControls={controls}
      className={cx(styles.orderRow, grabbed && styles.orderRowGrabbed, mark === "right" && styles.orderRight, mark === "wrong" && styles.orderWrong)}
      tabIndex={disabled ? -1 : 0}
      aria-describedby={describedBy}
      aria-label={t("practice.ordering.position", { item: entry.text, position: index + 1, total: count })}
      onKeyDown={(event: KeyboardEvent<HTMLLIElement>) => onKeyDown(event, index)}
      data-grabbed={grabbed || undefined}
      data-ordering-row=""
      layout="position"
      whileDrag={{ scale: 1.02, boxShadow: "var(--shadow-lg)" }}
    >
      <span
        className={styles.orderHandle}
        aria-hidden="true"
        onPointerDown={(event) => {
          if (!disabled) controls.start(event);
        }}
      >
        <GripIcon size={20} />
      </span>
      <span className={styles.orderIndex} aria-hidden="true">
        {index + 1}
      </span>
      <span className={styles.orderText}>{entry.text}</span>
      <span className={styles.orderButtons}>
        <button
          type="button"
          className={styles.orderButton}
          aria-label={t("practice.ordering.moveUp", { item: entry.text })}
          disabled={disabled || index === 0}
          tabIndex={-1}
          onClick={() => onMove(index, index - 1)}
        >
          <ChevronUpIcon size={18} />
        </button>
        <button
          type="button"
          className={styles.orderButton}
          aria-label={t("practice.ordering.moveDown", { item: entry.text })}
          disabled={disabled || index === count - 1}
          tabIndex={-1}
          onClick={() => onMove(index, index + 1)}
        >
          <ChevronDownIcon size={18} />
        </button>
      </span>
    </Reorder.Item>
  );
}

/**
 * Reorderable list that works three ways: drag with a mouse or finger, tap the
 * arrow buttons, or with the keyboard — Space picks an entry up, arrow keys move
 * it, Space drops it and Escape puts it back. Moves are announced politely.
 */
export function OrderingInput({ entries, order, onChange, disabled, marks, label }: OrderingInputProps) {
  const { t } = useT();
  const instructionsId = useId();
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const originalOrder = useRef<string[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const textOf = (id: string) => byId.get(id)?.text ?? id;

  function focusRow(index: number) {
    requestAnimationFrame(() => containerRef.current?.querySelectorAll<HTMLElement>("[data-ordering-row]")[index]?.focus());
  }

  function moveEntry(from: number, to: number, announce = true) {
    if (to < 0 || to >= order.length) return;
    const next = move(order, from, to);
    onChange(next);
    const id = next[to];
    if (announce && id) setAnnouncement(t("practice.ordering.moved", { item: textOf(id), position: to + 1, total: next.length }));
    focusRow(to);
  }

  function onKeyDown(event: KeyboardEvent<HTMLLIElement>, index: number) {
    if (disabled) return;
    const id = order[index];
    if (!id) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (grabbed === id) {
        setGrabbed(null);
        originalOrder.current = null;
        setAnnouncement(t("practice.ordering.dropped", { item: textOf(id), position: index + 1, total: order.length }));
      } else {
        setGrabbed(id);
        originalOrder.current = order;
        setAnnouncement(t("practice.ordering.grabbed", { item: textOf(id), position: index + 1, total: order.length }));
      }
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const target = event.key === "ArrowUp" ? index - 1 : index + 1;
      if (grabbed === id) moveEntry(index, target);
      else focusRow(Math.max(0, Math.min(order.length - 1, target)));
    } else if (event.key === "Escape" && grabbed) {
      event.preventDefault();
      if (originalOrder.current) onChange(originalOrder.current);
      setGrabbed(null);
      setAnnouncement(t("practice.ordering.cancelled"));
      originalOrder.current = null;
    }
  }

  return (
    <div ref={containerRef} className={styles.ordering}>
      <p id={instructionsId} className="sr-only">
        {t("practice.ordering.instructions")}
      </p>
      <Reorder.Group
        axis="y"
        values={order}
        onReorder={(next: string[]) => {
          if (!disabled) onChange(next);
        }}
        className={styles.orderList}
        aria-label={label}
      >
        {order.map((id, index) => {
          const entry = byId.get(id);
          if (!entry) return null;
          return (
            <OrderingRow
              key={id}
              entry={entry}
              index={index}
              count={order.length}
              grabbed={grabbed === id}
              disabled={disabled}
              mark={marks?.[id]}
              onKeyDown={onKeyDown}
              onMove={(from, to) => moveEntry(from, to)}
              describedBy={instructionsId}
            />
          );
        })}
      </Reorder.Group>
      <p className={styles.orderHint} aria-hidden="true">
        {t("practice.ordering.hint")}
      </p>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}

