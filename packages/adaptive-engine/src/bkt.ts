/**
 * Bayesian Knowledge Tracing (Corbett & Anderson, 1994). Complements the Rasch
 * ability estimate: Rasch tells us *how hard* an item is for a learner, BKT tells
 * us *whether the skill has been learned*, accounting for slips and lucky guesses.
 */
export interface BktParams {
  /** P(L0): probability the skill is known before any practice. */
  pInit: number;
  /** P(T): probability of learning the skill on each practice opportunity. */
  pTransit: number;
  /** P(S): probability of a wrong answer despite knowing the skill. */
  pSlip: number;
  /** P(G): probability of a right answer without knowing the skill. */
  pGuess: number;
}

export const DEFAULT_BKT: BktParams = {
  pInit: 0.2,
  pTransit: 0.12,
  pSlip: 0.08,
  pGuess: 0.2,
};

export function bktUpdate(pKnown: number, correct: boolean, params: BktParams = DEFAULT_BKT): number {
  const { pSlip, pGuess, pTransit } = params;
  const posterior = correct
    ? (pKnown * (1 - pSlip)) / (pKnown * (1 - pSlip) + (1 - pKnown) * pGuess)
    : (pKnown * pSlip) / (pKnown * pSlip + (1 - pKnown) * (1 - pGuess));
  return posterior + (1 - posterior) * pTransit;
}

/** Multiple-choice items with k options can be guessed with probability ~1/k. */
export function paramsForItem(
  base: BktParams,
  kind: "multiple_choice" | "numeric" | "short_text" | "ordering",
  choiceCount = 4,
): BktParams {
  switch (kind) {
    case "multiple_choice":
      return { ...base, pGuess: Math.min(0.5, 1 / Math.max(2, choiceCount)) };
    case "ordering":
      return { ...base, pGuess: 0.08 };
    default:
      return { ...base, pGuess: 0.05 };
  }
}

/**
 * Fits slip/guess/transit for a skill from many learners' answer sequences using a
 * simple grid search on log-likelihood. Runs nightly; sequences are short so a
 * coarse grid is plenty and is far more stable than gradient methods here.
 */
export function fitBkt(sequences: boolean[][], grid = 9): BktParams {
  let best = DEFAULT_BKT;
  let bestLl = -Infinity;
  const steps = (lo: number, hi: number) =>
    Array.from({ length: grid }, (_, i) => lo + ((hi - lo) * i) / (grid - 1));
  for (const pTransit of steps(0.02, 0.4)) {
    for (const pSlip of steps(0.01, 0.3)) {
      for (const pGuess of steps(0.01, 0.35)) {
        const params = { pInit: DEFAULT_BKT.pInit, pTransit, pSlip, pGuess };
        const ll = logLikelihood(sequences, params);
        if (ll > bestLl) {
          bestLl = ll;
          best = params;
        }
      }
    }
  }
  return best;
}

function logLikelihood(sequences: boolean[][], params: BktParams): number {
  let ll = 0;
  for (const seq of sequences) {
    let pKnown = params.pInit;
    for (const correct of seq) {
      const pCorrect = pKnown * (1 - params.pSlip) + (1 - pKnown) * params.pGuess;
      ll += Math.log(correct ? pCorrect : 1 - pCorrect);
      pKnown = bktUpdate(pKnown, correct, params);
    }
  }
  return ll;
}
