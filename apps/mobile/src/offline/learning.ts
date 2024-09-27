import { randomUUID } from "expo-crypto";
import {
  adaptiveTarget,
  applyAttempt,
  initialMastery,
  selectNextItem,
  type Candidate,
  type SelectionReason,
} from "@learnly/adaptive-engine";
import {
  asId,
  ENCOURAGEMENT,
  xpForAttempt,
  type AttemptInput,
  type EncouragementKey,
  type ItemId,
  type PublicItem,
  type Response,
  type SkillId,
  type SkillMastery,
} from "@learnly/shared";
import { isNetworkError, learningApi } from "../lib/api";
import { itemRepo, masteryRepo, type CachedItem } from "../db/repo";
import { attemptOperation, enqueue, lessonCompleteOperation, unconfirmedAttempts, type AttemptMeta } from "../sync/outbox";
import { isOnlineNow } from "../sync";

/* ----------------------------------------------------------------------------
 * Local scoring against answer keys learned from earlier online attempts.
 * ------------------------------------------------------------------------- */

export function normalizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[“”"'’.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length]!;
}

export interface LocalScore {
  correct: boolean;
  /** Near miss, used to pick "so close" encouragement rather than a generic one. */
  close: boolean;
}

export function scoreWithKey(response: Response, key: Response): LocalScore {
  switch (response.kind) {
    case "multiple_choice":
      return { correct: key.kind === "multiple_choice" && key.choiceId === response.choiceId, close: false };
    case "numeric": {
      if (key.kind !== "numeric") return { correct: false, close: false };
      const diff = Math.abs(response.value - key.value);
      const tolerance = Math.max(1e-6, Math.abs(key.value) * 1e-6);
      const correct = diff <= tolerance;
      return { correct, close: !correct && diff <= Math.max(0.5, Math.abs(key.value) * 0.1) };
    }
    case "short_text": {
      if (key.kind !== "short_text") return { correct: false, close: false };
      const a = normalizeText(response.text);
      const b = normalizeText(key.text);
      const correct = a === b;
      return { correct, close: !correct && b.length > 3 && editDistance(a, b) <= 1 };
    }
    case "ordering": {
      if (key.kind !== "ordering") return { correct: false, close: false };
      const inPlace = response.order.filter((id, i) => key.order[i] === id).length;
      const correct = inPlace === key.order.length && response.order.length === key.order.length;
      return { correct, close: !correct && inPlace >= key.order.length - 2 };
    }
  }
}

/* ----------------------------------------------------------------------------
 * Encouragement: warm, specific, never "Wrong!".
 * ------------------------------------------------------------------------- */

export interface EncouragementContext {
  correct: boolean;
  close: boolean;
  hintsUsed: number;
  /** Probability the learner was expected to get it right. */
  expectedSuccess: number;
  correctInRow: number;
  missesInRow: number;
  masteredSkillName?: string | null;
}

export function pickEncouragement(ctx: EncouragementContext): {
  key: EncouragementKey;
  values: Record<string, string | number>;
} {
  if (ctx.correct) {
    if (ctx.masteredSkillName) return { key: "mastered", values: { skill: ctx.masteredSkillName } };
    if (ctx.correctInRow >= 3) return { key: "correct_streak", values: { count: ctx.correctInRow } };
    if (ctx.hintsUsed > 0) return { key: "correct_after_hint", values: {} };
    if (ctx.expectedSuccess < 0.55) return { key: "correct_hard", values: {} };
    return { key: "correct", values: {} };
  }
  if (ctx.close) return { key: "incorrect_close", values: {} };
  return { key: ctx.missesInRow >= 1 ? "incorrect_again" : "incorrect_first", values: {} };
}

export function isEncouragementKey(key: string): key is EncouragementKey {
  return Object.prototype.hasOwnProperty.call(ENCOURAGEMENT, key);
}

/* ----------------------------------------------------------------------------
 * Mastery: server rows + optimistic replay of unconfirmed attempts.
 * ------------------------------------------------------------------------- */

export function replayEvidence(server: SkillMastery[], evidence: AttemptMeta[]): Map<SkillId, SkillMastery> {
  const map = new Map<SkillId, SkillMastery>(server.map((m) => [m.skillId, m]));
  for (const e of evidence) {
    if (e.correct === null) continue; // unscored until the server sees it
    const skillId = asId<SkillId>(e.skillId);
    const current = map.get(skillId) ?? initialMastery(skillId);
    map.set(
      skillId,
      applyAttempt(current, {
        difficulty: e.difficulty,
        correct: e.correct,
        hintsUsed: e.hintsUsed,
        answeredAt: e.answeredAt,
      }),
    );
  }
  return map;
}

export async function effectiveMastery(): Promise<Map<SkillId, SkillMastery>> {
  const [server, pending] = await Promise.all([masteryRepo.all(), unconfirmedAttempts()]);
  return replayEvidence(server, pending);
}

/* ----------------------------------------------------------------------------
 * Submitting an answer: online when possible, otherwise to the outbox.
 * ------------------------------------------------------------------------- */

export interface SubmitInput {
  item: PublicItem;
  response: Response;
  hintsUsed: number;
  durationMs: number;
  sessionId?: string | null;
  /** Context for encouragement selection. */
  correctInRow: number;
  missesInRow: number;
}

export type AnswerOutcome =
  | {
      status: "scored";
      source: "server" | "local";
      correct: boolean;
      correctResponse: Response | null;
      explanation: string | null;
      xpEarned: number;
      encouragement: { key: EncouragementKey; values: Record<string, string | number> };
      mastery: SkillMastery;
      previousMastery: SkillMastery;
    }
  | { status: "saved"; xpEarned: number };

export async function submitAnswer(input: SubmitInput): Promise<AnswerOutcome> {
  const { item, response, hintsUsed, durationMs } = input;
  const answeredAt = new Date().toISOString();
  const clientAttemptId = randomUUID();
  const payload: AttemptInput = {
    itemId: item.id,
    sessionId: input.sessionId ?? null,
    response,
    hintsUsed,
    durationMs: Math.min(Math.round(durationMs), 60 * 60 * 1000),
    clientAttemptId,
    answeredAt,
  };
  const before = (await effectiveMastery()).get(item.skillId) ?? initialMastery(item.skillId);

  if (isOnlineNow()) {
    try {
      const result = await learningApi.submitAttempt(payload);
      await Promise.all([
        itemRepo.rememberKey(item.id, result.correctResponse, result.explanation),
        masteryRepo.upsert([result.mastery], answeredAt),
      ]);
      const fallback = pickEncouragement({
        correct: result.correct,
        close: false,
        hintsUsed,
        expectedSuccess: 0.75,
        correctInRow: input.correctInRow + (result.correct ? 1 : 0),
        missesInRow: input.missesInRow,
      });
      return {
        status: "scored",
        source: "server",
        correct: result.correct,
        correctResponse: result.correctResponse,
        explanation: result.explanation,
        xpEarned: result.xpEarned,
        encouragement: {
          key: isEncouragementKey(result.encouragementKey) ? result.encouragementKey : fallback.key,
          values: fallback.values,
        },
        mastery: result.mastery,
        previousMastery: before,
      };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      // Fall through: the same clientAttemptId goes to the outbox, so a request that
      // actually landed before the connection dropped is deduplicated by the server.
    }
  }

  const cached = await itemRepo.get(item.id);
  const key = cached?.key ?? null;
  const score = key ? scoreWithKey(response, key) : null;
  const meta: AttemptMeta = {
    kind: "attempt",
    skillId: item.skillId,
    difficulty: item.difficulty,
    correct: score?.correct ?? null,
    hintsUsed,
    answeredAt,
  };
  await enqueue(attemptOperation(payload), meta);

  if (!score) return { status: "saved", xpEarned: xpForAttempt(false, hintsUsed, true) };

  const after = applyAttempt(before, { difficulty: item.difficulty, correct: score.correct, hintsUsed, answeredAt });
  const expected = 1 / (1 + Math.exp(-(before.ability - item.difficulty)));
  return {
    status: "scored",
    source: "local",
    correct: score.correct,
    correctResponse: key,
    explanation: cached?.explanation ?? null,
    xpEarned: xpForAttempt(score.correct, hintsUsed, hintsUsed === 0),
    encouragement: pickEncouragement({
      correct: score.correct,
      close: score.close,
      hintsUsed,
      expectedSuccess: expected,
      correctInRow: input.correctInRow + (score.correct ? 1 : 0),
      missesInRow: input.missesInRow,
    }),
    mastery: after,
    previousMastery: before,
  };
}

export async function completeLesson(lessonId: string, durationMs: number): Promise<{ xpEarned: number; queued: boolean }> {
  if (isOnlineNow()) {
    try {
      const result = await learningApi.completeLesson(lessonId, durationMs);
      return { xpEarned: result.xpEarned, queued: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await enqueue(lessonCompleteOperation(lessonId, durationMs), {
    kind: "lesson",
    lessonId,
    minutes: Math.max(1, Math.round(durationMs / 60_000)),
  });
  return { xpEarned: 25, queued: true };
}

/* ----------------------------------------------------------------------------
 * Offline item selection over cached items using the adaptive engine.
 * ------------------------------------------------------------------------- */

export interface OfflinePick {
  item: PublicItem;
  reason: SelectionReason;
  expectedSuccess: number;
  scorable: boolean;
}

export function chooseOfflineItem(
  pool: CachedItem[],
  mastery: Map<SkillId, SkillMastery>,
  history: { itemIds: string[]; skillIds: string[]; correct: boolean[] },
  random: () => number = Math.random,
): OfflinePick | null {
  // Prefer items we can score locally so feedback stays instant; fall back to the rest.
  const scorable = pool.filter((p) => p.key !== null);
  const source = scorable.length > 0 ? scorable : pool;
  const byId = new Map(source.map((p) => [p.item.id as string, p]));
  const candidates: Candidate[] = source.map((p) => ({
    id: p.item.id,
    skillId: p.item.skillId,
    difficulty: p.item.difficulty,
  }));
  const selection = selectNextItem(candidates, mastery, {
    targetSuccess: adaptiveTarget(history.correct),
    recentItemIds: history.itemIds.map((id) => asId<ItemId>(id)),
    recentSkillIds: history.skillIds.slice(-4).map((id) => asId<SkillId>(id)),
    random,
  });
  if (!selection) return null;
  const picked = byId.get(selection.item.id);
  if (!picked) return null;
  return {
    item: picked.item,
    reason: selection.reason,
    expectedSuccess: selection.expectedSuccess,
    scorable: picked.key !== null,
  };
}

export async function nextOfflineItem(
  skillIds: string[],
  history: { itemIds: string[]; skillIds: string[]; correct: boolean[] },
): Promise<OfflinePick | null> {
  const [pool, mastery] = await Promise.all([itemRepo.forSkills(skillIds), effectiveMastery()]);
  return chooseOfflineItem(pool, mastery, history);
}
