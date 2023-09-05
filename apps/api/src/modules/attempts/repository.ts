import type {
  Attempt,
  AttemptId,
  ItemId,
  MasteryBand,
  Response,
  SessionId,
  SkillId,
  SkillMastery,
  UserId,
} from "@learnly/shared";
import { toIso, type Database } from "../../db/sql.js";

export interface NewAttempt {
  userId: UserId;
  itemId: ItemId;
  skillId: SkillId;
  sessionId: SessionId | null;
  clientAttemptId: string | null;
  response: Response;
  correct: boolean;
  hintsUsed: number;
  durationMs: number;
  abilityBefore: number;
  answeredAt: string;
}

export interface AttemptRepository {
  findByClientId(userId: UserId, clientAttemptId: string): Promise<Attempt | null>;
  /** Returns null when an attempt with the same client id already exists. */
  insert(attempt: NewAttempt): Promise<Attempt | null>;
}

export interface MasteryRepository {
  find(userId: UserId, skillId: SkillId): Promise<SkillMastery | null>;
  listForUser(userId: UserId, skillIds?: SkillId[]): Promise<SkillMastery[]>;
  upsert(userId: UserId, mastery: SkillMastery): Promise<void>;
}

interface AttemptRow {
  id: AttemptId;
  user_id: UserId;
  item_id: ItemId;
  skill_id: SkillId;
  session_id: SessionId | null;
  response: Response;
  correct: boolean;
  hints_used: number;
  duration_ms: number;
  answered_at: Date;
}

const ATTEMPT_COLUMNS =
  "id, user_id, item_id, skill_id, session_id, response, correct, hints_used, duration_ms, answered_at";

export function toAttempt(row: AttemptRow): Attempt {
  return {
    id: row.id,
    userId: row.user_id,
    itemId: row.item_id,
    skillId: row.skill_id,
    sessionId: row.session_id,
    response: row.response,
    correct: row.correct,
    hintsUsed: row.hints_used,
    durationMs: row.duration_ms,
    answeredAt: toIso(row.answered_at),
  };
}

export class PgAttemptRepository implements AttemptRepository {
  constructor(private readonly db: Database) {}

  async findByClientId(userId: UserId, clientAttemptId: string): Promise<Attempt | null> {
    const row = await this.db.maybeOne<AttemptRow>(
      `select ${ATTEMPT_COLUMNS} from attempts where user_id = $1 and client_attempt_id = $2`,
      [userId, clientAttemptId],
    );
    return row ? toAttempt(row) : null;
  }

  async insert(attempt: NewAttempt): Promise<Attempt | null> {
    const row = await this.db.maybeOne<AttemptRow>(
      `insert into attempts (user_id, item_id, skill_id, session_id, client_attempt_id, response,
                             correct, hints_used, duration_ms, ability_before, answered_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (user_id, client_attempt_id) where client_attempt_id is not null do nothing
       returning ${ATTEMPT_COLUMNS}`,
      [
        attempt.userId,
        attempt.itemId,
        attempt.skillId,
        attempt.sessionId,
        attempt.clientAttemptId,
        JSON.stringify(attempt.response),
        attempt.correct,
        attempt.hintsUsed,
        attempt.durationMs,
        attempt.abilityBefore,
        attempt.answeredAt,
      ],
    );
    return row ? toAttempt(row) : null;
  }
}

interface MasteryRow {
  skill_id: SkillId;
  p_known: number;
  ability: number;
  band: MasteryBand;
  attempts: number;
  last_practiced_at: Date | null;
  due_at: Date | null;
}

const MASTERY_COLUMNS = "skill_id, p_known, ability, band, attempts, last_practiced_at, due_at";

export function toMastery(row: MasteryRow): SkillMastery {
  return {
    skillId: row.skill_id,
    pKnown: row.p_known,
    ability: row.ability,
    band: row.band,
    attempts: row.attempts,
    lastPracticedAt: toIso(row.last_practiced_at),
    dueAt: toIso(row.due_at),
  };
}

export class PgMasteryRepository implements MasteryRepository {
  constructor(private readonly db: Database) {}

  async find(userId: UserId, skillId: SkillId): Promise<SkillMastery | null> {
    const row = await this.db.maybeOne<MasteryRow>(
      `select ${MASTERY_COLUMNS} from skill_mastery where user_id = $1 and skill_id = $2`,
      [userId, skillId],
    );
    return row ? toMastery(row) : null;
  }

  async listForUser(userId: UserId, skillIds?: SkillId[]): Promise<SkillMastery[]> {
    const rows = await this.db.query<MasteryRow>(
      `select ${MASTERY_COLUMNS} from skill_mastery
        where user_id = $1 and ($2::uuid[] is null or skill_id = any($2::uuid[]))`,
      [userId, skillIds ?? null],
    );
    return rows.map(toMastery);
  }

  async upsert(userId: UserId, mastery: SkillMastery): Promise<void> {
    await this.db.query(
      `insert into skill_mastery (user_id, skill_id, p_known, ability, band, attempts, last_practiced_at, due_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, now())
       on conflict (user_id, skill_id) do update
          set p_known = excluded.p_known,
              ability = excluded.ability,
              band = excluded.band,
              attempts = excluded.attempts,
              last_practiced_at = excluded.last_practiced_at,
              due_at = excluded.due_at,
              updated_at = now()`,
      [
        userId,
        mastery.skillId,
        mastery.pKnown,
        mastery.ability,
        mastery.band,
        mastery.attempts,
        mastery.lastPracticedAt,
        mastery.dueAt,
      ],
    );
  }
}
