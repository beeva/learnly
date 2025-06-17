import type { SkillMastery } from "@learnly/shared";

/**
 * A light SM-2 variant tuned for kids: intervals expand on success, but a miss
 * brings the skill back tomorrow rather than resetting everything.
 */
export interface ReviewState {
  intervalDays: number;
  ease: number;
  repetitions: number;
}

export const INITIAL_REVIEW: ReviewState = { intervalDays: 0, ease: 2.3, repetitions: 0 };

export function nextReview(state: ReviewState, quality: 0 | 1 | 2 | 3 | 4 | 5): ReviewState {
  if (quality < 3) {
    return { intervalDays: 1, ease: Math.max(1.3, state.ease - 0.2), repetitions: 0 };
  }
  const ease = Math.max(1.3, state.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const repetitions = state.repetitions + 1;
  const intervalDays =
    repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.round(state.intervalDays * ease);
  return { intervalDays: Math.min(intervalDays, 60), ease, repetitions };
}

