import { applyAttempt, initialMastery } from "@learnly/adaptive-engine";
import type { Attempt, AttemptInput, Item, ItemId, Response, SessionId, SkillId, SkillMastery, UserId } from "@learnly/shared";
import type { TransactionRunner } from "../../db/sql.js";
import type { Clock } from "../../lib/clock.js";
import { notFound, validationFailed } from "../../lib/errors.js";
import { scoreResponse } from "../../lib/scoring.js";
import type { CatalogRepository } from "../catalog/repository.js";
import type { AttemptRepository, MasteryRepository } from "./repository.js";

export interface MasteryEvidence {
  correct: boolean;
  hintsUsed: number;
  durationMs: number;
  answeredAt: string;
}

/**
 * How a skill estimate responds to an answer. The attempt flow only depends on this
 * interface, so the engine behind it can be swapped (and A/B tested) without touching
 * scoring, idempotency or rewards.
 */
export interface MasteryModel {
  current(userId: UserId, skillId: SkillId): Promise<SkillMastery>;
  record(userId: UserId, item: Item, evidence: MasteryEvidence): Promise<SkillMastery>;
}

function latest(a: string | null, b: string): string {
  return a !== null && Date.parse(a) > Date.parse(b) ? a : b;
}

/** Engine v1: Elo-style Rasch ability updates, pKnown read off the ability. */
export class RaschMasteryModel implements MasteryModel {
  constructor(private readonly mastery: MasteryRepository) {}

  async current(userId: UserId, skillId: SkillId): Promise<SkillMastery> {
    return (await this.mastery.find(userId, skillId)) ?? initialMastery(skillId);
  }

  async record(userId: UserId, item: Item, evidence: MasteryEvidence): Promise<SkillMastery> {
    const before = await this.current(userId, item.skillId);
    const after = applyAttempt(before, {
      difficulty: item.difficulty,
      correct: evidence.correct,
      hintsUsed: evidence.hintsUsed,
      answeredAt: evidence.answeredAt,
    });
    // Offline answers can arrive out of order; never move "last practiced" backwards.
    const next = { ...after, lastPracticedAt: latest(before.lastPracticedAt, evidence.answeredAt) };
    await this.mastery.upsert(userId, next);
    return next;
  }
}

/** The core of an attempt result; later features add XP and encouragement on top. */
export interface ScoredAttempt {
  attempt: Attempt;
  correct: boolean;
  explanation: string;
  correctResponse: Response;
  mastery: SkillMastery;
}

export interface SubmissionOutcome {
  body: ScoredAttempt;
  /** True when this was a retry of an attempt we had already recorded. */
  replayed: boolean;
  item: Item;
  /** Mastery right before this attempt (equal to `body.mastery` on replays). */
  previousMastery: SkillMastery;
  /** Wrong, but nearly right — see `scoreResponse`. */
  close: boolean;
}

/** The attempt pipeline. Decorated by sessions, progress and metrics. */
export interface AttemptSubmitter {
  submit(userId: UserId, input: AttemptInput): Promise<SubmissionOutcome>;
}

/** Client clocks drift; accept answers from the past (offline) but not from the future. */
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

export function resolveAnsweredAt(claimed: string | undefined, now: Date): string {
  if (!claimed) return now.toISOString();
  const at = Date.parse(claimed);
  if (Number.isNaN(at) || at > now.getTime() + MAX_CLOCK_SKEW_MS) return now.toISOString();
  return new Date(at).toISOString();
}

export interface AttemptServiceDeps {
  catalog: CatalogRepository;
  attempts: AttemptRepository;
  mastery: MasteryModel;
  transactions: TransactionRunner;
  clock: Clock;
}

export class AttemptService implements AttemptSubmitter {
  constructor(private readonly deps: AttemptServiceDeps) {}

  async submit(userId: UserId, input: AttemptInput): Promise<SubmissionOutcome> {
    const item = await this.deps.catalog.findItem(input.itemId as ItemId);
    if (!item) throw notFound("question");
    if (input.response.kind !== item.kind) {
      throw validationFailed("That answer doesn't match this kind of question.", {
        expected: item.kind,
        received: input.response.kind,
      });
    }

    const clientAttemptId = input.clientAttemptId ?? null;
    if (clientAttemptId) {
      const existing = await this.deps.attempts.findByClientId(userId, clientAttemptId);
      if (existing) return this.replay(userId, existing, item);
    }

    const score = scoreResponse(item, input.response);
    const answeredAt = resolveAnsweredAt(input.answeredAt, this.deps.clock.now());
    const hintsUsed = Math.min(input.hintsUsed, item.hints.length);

    return this.deps.transactions.transaction(async () => {
      const previousMastery = await this.deps.mastery.current(userId, item.skillId);
      const attempt = await this.deps.attempts.insert({
        userId,
        itemId: item.id,
        skillId: item.skillId,
        sessionId: (input.sessionId ?? null) as SessionId | null,
        clientAttemptId,
        response: input.response,
        correct: score.correct,
        hintsUsed,
        durationMs: input.durationMs,
        abilityBefore: previousMastery.ability,
        answeredAt,
      });
      if (!attempt) {
        // A concurrent retry won the insert; answer exactly as it was answered.
        const winner = clientAttemptId ? await this.deps.attempts.findByClientId(userId, clientAttemptId) : null;
        if (!winner) throw new Error("attempt insert conflicted but no attempt was found");
        return this.replay(userId, winner, item);
      }
      const mastery = await this.deps.mastery.record(userId, item, {
        correct: score.correct,
        hintsUsed,
        durationMs: input.durationMs,
        answeredAt,
      });
      return {
        body: {
          attempt,
          correct: score.correct,
          explanation: item.explanation,
          correctResponse: score.correctResponse,
          mastery,
        },
        replayed: false,
        item,
        previousMastery,
        close: score.close,
      };
    });
  }

  private async replay(userId: UserId, attempt: Attempt, item: Item): Promise<SubmissionOutcome> {
    const mastery = await this.deps.mastery.current(userId, item.skillId);
    const score = scoreResponse(item, attempt.response);
    return {
      body: {
        attempt,
        correct: attempt.correct,
        explanation: item.explanation,
        correctResponse: score.correctResponse,
        mastery,
      },
      replayed: true,
      item,
      previousMastery: mastery,
      close: false,
    };
  }
}
