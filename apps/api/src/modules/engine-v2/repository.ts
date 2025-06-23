import type { BktParams, ReviewState } from "@learnly/adaptive-engine";
import type { SkillId, UserId } from "@learnly/shared";
import type { Database } from "../../db/sql.js";

export interface ReviewStateRepository {
  get(userId: UserId, skillId: SkillId): Promise<ReviewState | null>;
  save(userId: UserId, skillId: SkillId, state: ReviewState): Promise<void>;
}

export interface FitStats {
  learners: number;
  observations: number;
}

export interface BktParamsRepository {
  forSkill(skillId: SkillId): Promise<BktParams | null>;
  save(skillId: SkillId, params: BktParams, stats: FitStats, at: string): Promise<void>;
}

export class PgReviewStateRepository implements ReviewStateRepository {
  constructor(private readonly db: Database) {}

  async get(userId: UserId, skillId: SkillId): Promise<ReviewState | null> {
    const row = await this.db.maybeOne<{ interval_days: number; ease: number; repetitions: number }>(
      "select interval_days, ease, repetitions from skill_review_state where user_id = $1 and skill_id = $2",
      [userId, skillId],
    );
    return row ? { intervalDays: row.interval_days, ease: row.ease, repetitions: row.repetitions } : null;
  }

  async save(userId: UserId, skillId: SkillId, state: ReviewState): Promise<void> {
    await this.db.query(
      `insert into skill_review_state (user_id, skill_id, interval_days, ease, repetitions)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, skill_id) do update set
         interval_days = excluded.interval_days, ease = excluded.ease,
         repetitions = excluded.repetitions, updated_at = now()`,
      [userId, skillId, state.intervalDays, state.ease, state.repetitions],
    );
  }
}

export class PgBktParamsRepository implements BktParamsRepository {
  constructor(private readonly db: Database) {}

  async forSkill(skillId: SkillId): Promise<BktParams | null> {
    const row = await this.db.maybeOne<{ p_init: number; p_transit: number; p_slip: number; p_guess: number }>(
      "select p_init, p_transit, p_slip, p_guess from skill_bkt_params where skill_id = $1",
      [skillId],
    );
    return row ? { pInit: row.p_init, pTransit: row.p_transit, pSlip: row.p_slip, pGuess: row.p_guess } : null;
  }

  async save(skillId: SkillId, params: BktParams, stats: FitStats, at: string): Promise<void> {
    await this.db.query(
      `insert into skill_bkt_params (skill_id, p_init, p_transit, p_slip, p_guess, learners, observations, fitted_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (skill_id) do update set
         p_init = excluded.p_init, p_transit = excluded.p_transit, p_slip = excluded.p_slip,
         p_guess = excluded.p_guess, learners = excluded.learners,
         observations = excluded.observations, fitted_at = excluded.fitted_at`,
      [skillId, params.pInit, params.pTransit, params.pSlip, params.pGuess, stats.learners, stats.observations, at],
    );
  }
}
