import type { PublicItem, Response } from "@learnly/shared";

/** What the learner has typed or picked so far — may be incomplete. */
export type Draft =
  | { kind: "multiple_choice"; choiceId: string | null }
  | { kind: "numeric"; raw: string }
  | { kind: "short_text"; text: string }
  | { kind: "ordering"; order: string[]; touched: boolean };

export function emptyDraft(item: PublicItem): Draft {
  switch (item.kind) {
    case "multiple_choice":
      return { kind: "multiple_choice", choiceId: null };
    case "numeric":
      return { kind: "numeric", raw: "" };
    case "short_text":
      return { kind: "short_text", text: "" };
    case "ordering":
      return { kind: "ordering", order: item.entries.map((entry) => entry.id), touched: false };
  }
}

/**
 * Parse what a student types into a number. Accepts "12", "-3.5", "3,5"
 * (decimal comma), "1 000" and simple fractions like "3/4".
 */
export function parseNumeric(raw: string): number | null {
  const compact = raw.trim().replace(/\s+/g, "");
  if (!compact) return null;
  const fraction = /^(-?\d+(?:[.,]\d+)?)\/(\d+(?:[.,]\d+)?)$/.exec(compact);
  if (fraction) {
    const numerator = Number(fraction[1]!.replace(",", "."));
    const denominator = Number(fraction[2]!.replace(",", "."));
    return denominator === 0 ? null : numerator / denominator;
  }
  if (!/^-?\d*(?:[.,]\d+)?$/.test(compact) || compact === "-") return null;
  const value = Number(compact.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Turn a draft into a submittable response, or null when it isn't ready yet. */
export function toResponse(draft: Draft): Response | null {
  switch (draft.kind) {
    case "multiple_choice":
      return draft.choiceId ? { kind: "multiple_choice", choiceId: draft.choiceId } : null;
    case "numeric": {
      const value = parseNumeric(draft.raw);
      return value === null ? null : { kind: "numeric", value };
    }
    case "short_text": {
      const text = draft.text.trim();
      return text ? { kind: "short_text", text } : null;
    }
    case "ordering":
      return draft.order.length >= 2 ? { kind: "ordering", order: draft.order } : null;
  }
}

/** Why a draft can't be submitted yet, for a gentle inline nudge. */
export function draftProblem(draft: Draft): "choose" | "number" | "empty" | null {
  if (toResponse(draft)) return null;
  if (draft.kind === "multiple_choice") return "choose";
  if (draft.kind === "numeric") return draft.raw.trim() ? "number" : "empty";
  return "empty";
}

/** Human-readable version of a response for "The answer was…" lines. */
export function describeResponse(item: PublicItem, response: Response): string {
  switch (response.kind) {
    case "multiple_choice":
      return item.kind === "multiple_choice" ? (item.choices.find((choice) => choice.id === response.choiceId)?.text ?? response.choiceId) : response.choiceId;
    case "numeric": {
      const unit = item.kind === "numeric" && item.unit ? ` ${item.unit}` : "";
      return `${response.value}${unit}`;
    }
    case "short_text":
      return response.text;
    case "ordering":
      return item.kind === "ordering"
        ? response.order.map((id) => item.entries.find((entry) => entry.id === id)?.text ?? id).join(" → ")
        : response.order.join(" → ");
  }
}

/** Move an element within a list, returning a new array. */
export function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [entry] = next.splice(from, 1);
  next.splice(to, 0, entry as T);
  return next;
}
