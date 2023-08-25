import type { Item, OrderingItem, Response } from "@learnly/shared";

export interface Score {
  correct: boolean;
  /**
   * The answer was wrong but nearly right (a sign slip, an arithmetic slip, a typo, two
   * steps swapped). Drives the "So close — check the last step" encouragement.
   */
  close: boolean;
  correctResponse: Response;
}

/** The canonical right answer for an item, returned to the learner after they answer. */
export function correctResponseFor(item: Item): Response {
  switch (item.kind) {
    case "multiple_choice":
      return { kind: "multiple_choice", choiceId: item.answer };
    case "numeric":
      return { kind: "numeric", value: item.answer };
    case "short_text":
      return { kind: "short_text", text: item.acceptedAnswers[0] ?? "" };
    case "ordering":
      return { kind: "ordering", order: [...item.answer] };
  }
}

/**
 * Pure scoring: no I/O, no clock. The same function backs the REST endpoint and offline
 * sync replay, so an answer always scores the same way no matter how it arrives.
 */
export function scoreResponse(item: Item, response: Response): Score {
  const correctResponse = correctResponseFor(item);
  const miss: Score = { correct: false, close: false, correctResponse };

  switch (item.kind) {
    case "multiple_choice":
      if (response.kind !== "multiple_choice") return miss;
      return { correct: response.choiceId === item.answer, close: false, correctResponse };

    case "numeric": {
      if (response.kind !== "numeric" || !Number.isFinite(response.value)) return miss;
      const error = Math.abs(response.value - item.answer);
      // Floating point: 0.1 + 0.2 must still equal 0.3 when the tolerance is zero.
      const correct = error <= item.tolerance + 1e-9;
      const nearby = error <= Math.max(item.tolerance * 4, Math.abs(item.answer) * 0.1);
      const signSlip = item.answer !== 0 && response.value === -item.answer;
      return { correct, close: !correct && (nearby || signSlip), correctResponse };
    }

    case "short_text": {
      if (response.kind !== "short_text") return miss;
      const given = normalizeText(response.text);
      if (given.length === 0) return miss;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const accepted of item.acceptedAnswers) {
        const expected = normalizeText(accepted);
        if (textEquivalent(given, expected)) return { correct: true, close: false, correctResponse };
        const distance = levenshtein(given, expected);
        // Forgive a single typo in longer words ("persistant"), never in short answers
        // where one letter can change the meaning ("cat" vs "car", "3/4" vs "3/5").
        if (distance === 1 && expected.length >= 8) return { correct: true, close: false, correctResponse };
        bestDistance = Math.min(bestDistance, distance);
      }
      return { correct: false, close: bestDistance <= 2, correctResponse };
    }

    case "ordering": {
      if (response.kind !== "ordering") return miss;
      const correct =
        response.order.length === item.answer.length &&
        response.order.every((id, index) => id === item.answer[index]);
      return { correct, close: !correct && orderingIsClose(item, response.order), correctResponse };
    }
  }
}

/**
 * Case-, whitespace- and punctuation-insensitive comparison form. Curly quotes from
 * mobile keyboards are straightened, and wrapping quotes or a trailing full stop dropped.
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/[.!?,;:]+$/g, "")
    .trim();
}

function textEquivalent(given: string, expected: string): boolean {
  if (given === expected) return true;
  // "the main idea" vs "main idea"
  const withoutArticle = (s: string) => s.replace(/^(a|an|the) /, "");
  if (withoutArticle(given) === withoutArticle(expected)) return true;
  // "0.5" vs ".5", "3" vs "3.0"
  const a = toNumber(given);
  const b = toNumber(expected);
  return a !== null && b !== null && Math.abs(a - b) < 1e-9;
}

function toNumber(value: string): number | null {
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Wrong only by one adjacent swap, or at least three quarters of the steps in place. */
function orderingIsClose(item: OrderingItem, order: string[]): boolean {
  if (order.length !== item.answer.length) return false;
  const misplaced = order.flatMap((id, index) => (id === item.answer[index] ? [] : [index]));
  const [first, second] = misplaced;
  if (misplaced.length === 2 && first !== undefined && second !== undefined && second - first === 1) {
    return true;
  }
  return (order.length - misplaced.length) / order.length >= 0.75;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
    }
    previous = current;
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}
