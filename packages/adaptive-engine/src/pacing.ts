export type PaceDecision = "slow_down" | "steady" | "speed_up";

export interface PaceSignal {
  correct: boolean;
  durationMs: number;
  hintsUsed: number;
}

export interface PaceRecommendation {
  decision: PaceDecision;
  /** Suggested lesson level delta to apply to the next lesson (-1, 0, +1). */
  levelDelta: -1 | 0 | 1;
  /** Whether to insert a worked example before the next practice item. */
  insertWorkedExample: boolean;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function recommendPace(signals: PaceSignal[], expectedMs = 45_000): PaceRecommendation {
  const recent = signals.slice(-6);
  if (recent.length < 3) return { decision: "steady", levelDelta: 0, insertWorkedExample: false };

  const accuracy = recent.filter((s) => s.correct).length / recent.length;
  const hintRate = recent.reduce((n, s) => n + s.hintsUsed, 0) / recent.length;
  const speed = median(recent.map((s) => s.durationMs)) / expectedMs;

  if (accuracy < 0.5 || hintRate > 1.2) {
    return { decision: "slow_down", levelDelta: -1, insertWorkedExample: true };
  }
  if (accuracy >= 0.85 && hintRate < 0.3 && speed < 0.8) {
    return { decision: "speed_up", levelDelta: 1, insertWorkedExample: false };
  }
  return { decision: "steady", levelDelta: 0, insertWorkedExample: accuracy < 0.65 };
}

/**
 * Very fast wrong answers in a row usually mean a learner is guessing to get
 * through. We don't penalise it — we suggest a break or a different activity.
 */
export function looksLikeRapidGuessing(signals: PaceSignal[], thresholdMs = 4000): boolean {
  const recent = signals.slice(-4);
  return recent.length === 4 && recent.every((s) => !s.correct && s.durationMs < thresholdMs);
}
