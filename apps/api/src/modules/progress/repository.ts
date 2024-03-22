import type { ItemId, LessonId, SessionId, SkillId, StreakState, UserId } from "@learnly/shared";
import { toIso, type Database } from "../../db/sql.js";

export type XpReason = "attempt" | "lesson_complete" | "diagnostic_complete" | "streak_bonus";

export interface ProgressRecord {
  totalXp: number;
  streak: StreakState;
}

export interface ActivityDay {
  day: string;
  minutes: number;
  itemsCorrect: number;
}

export interface ActivityDelta {
  seconds: number;
  answered: number;
  correct: number;
  lessons: number;
}

export interface RecentResult {
  itemId: ItemId;
  skillId: SkillId;
  correct: boolean;
  hintsUsed: number;
  durationMs: number;
  answeredAt: string;
}

export interface XpAward {
  amount: number;
  reason: XpReason;
  sourceId: string;
  sessionId: SessionId | null;
}

export const NEW_LEARNER_FREEZES = 2;

export interface ProgressRepository {
  get(userId: UserId): Promise<ProgressRecord>;
  saveStreak(userId: UserId, streak: StreakState): Promise<void>;
  /** Records an award once per (reason, source). Returns the XP actually granted. */
  addXp(userId: UserId, award: XpAward): Promise<number>;
  xpFor(userId: UserId, reason: XpReason, sourceId: string): Promise<number>;
  xpForSession(userId: UserId, sessionId: SessionId): Promise<number>;
  addActivity(userId: UserId, day: string, delta: ActivityDelta): Promise<void>;
  activityBetween(userId: UserId, fromDay: string, toDay: string): Promise<ActivityDay[]>;
  /** Most recent answers first. */
  recentResults(userId: UserId, limit: number): Promise<RecentResult[]>;
  countItemAttempts(userId: UserId, itemId: ItemId): Promise<number>;
  recordLessonCompletion(userId: UserId, lessonId: LessonId, durationMs: number, at: string): Promise<void>;
  completedLessonIds(userId: UserId): Promise<LessonId[]>;
}

interface ProgressRow {
  total_xp: number;
  streak_current: number;
  streak_longest: number;
  last_active_day: string | null;
  freezes_available: number;
}

export class PgProgressRepository implements ProgressRepository {
  constructor(private readonly db: Database) {}

  async get(userId: UserId): Promise<ProgressRecord> {
    const row = await this.db.maybeOne<ProgressRow>(
      `select total_xp, streak_current, streak_longest, last_active_day, freezes_available
         from user_progress where user_id = $1`,
      [userId],
    );
    return {
      totalXp: row?.total_xp ?? 0,
      streak: {
        current: row?.streak_current ?? 0,
        longest: row?.streak_longest ?? 0,
        lastActiveDay: row?.last_active_day ?? null,
        freezesAvailable: row?.freezes_available ?? NEW_LEARNER_FREEZES,
      },
    };
  }

  async saveStreak(userId: UserId, streak: StreakState): Promise<void> {
    await this.db.query(
      `insert into user_progress (user_id, streak_current, streak_longest, last_active_day, freezes_available)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id) do update set
         streak_current = excluded.streak_current,
         streak_longest = excluded.streak_longest,
         last_active_day = excluded.last_active_day,
         freezes_available = excluded.freezes_available,
         updated_at = now()`,
      [userId, streak.current, streak.longest, streak.lastActiveDay, streak.freezesAvailable],
    );
  }

  async addXp(userId: UserId, award: XpAward): Promise<number> {
    if (award.amount <= 0) return 0;
    // Both statements run in one round trip; the total only moves if the ledger row is new.
    const row = await this.db.one<{ awarded: number }>(
      `with inserted as (
         insert into xp_events (user_id, amount, reason, source_id, session_id)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id, reason, source_id) do nothing
         returning amount
       ), total as (
         insert into user_progress (user_id, total_xp)
         select $1, amount from inserted
         on conflict (user_id) do update
           set total_xp = user_progress.total_xp + excluded.total_xp, updated_at = now()
       )
       select coalesce((select amount from inserted), 0)::int as awarded`,
      [userId, award.amount, award.reason, award.sourceId, award.sessionId],
    );
    return row.awarded;
  }

  async xpFor(userId: UserId, reason: XpReason, sourceId: string): Promise<number> {
    const row = await this.db.maybeOne<{ amount: number }>(
      "select amount from xp_events where user_id = $1 and reason = $2 and source_id = $3",
      [userId, reason, sourceId],
    );
    return row?.amount ?? 0;
  }

  async xpForSession(userId: UserId, sessionId: SessionId): Promise<number> {
    const row = await this.db.one<{ total: number }>(
      "select coalesce(sum(amount), 0)::int as total from xp_events where user_id = $1 and session_id = $2",
      [userId, sessionId],
    );
    return row.total;
  }

  async addActivity(userId: UserId, day: string, delta: ActivityDelta): Promise<void> {
    await this.db.query(
      `insert into daily_activity (user_id, day, active_seconds, items_answered, items_correct, lessons_completed)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id, day) do update set
         active_seconds = daily_activity.active_seconds + excluded.active_seconds,
         items_answered = daily_activity.items_answered + excluded.items_answered,
         items_correct = daily_activity.items_correct + excluded.items_correct,
         lessons_completed = daily_activity.lessons_completed + excluded.lessons_completed`,
      [userId, day, Math.round(delta.seconds), delta.answered, delta.correct, delta.lessons],
    );
  }

  async activityBetween(userId: UserId, fromDay: string, toDay: string): Promise<ActivityDay[]> {
    const rows = await this.db.query<{ day: string; active_seconds: number; items_correct: number }>(
      `select day, active_seconds, items_correct from daily_activity
        where user_id = $1 and day between $2 and $3
        order by day`,
      [userId, fromDay, toDay],
    );
    return rows.map((row) => ({
      day: row.day,
      minutes: Math.round(row.active_seconds / 60),
      itemsCorrect: row.items_correct,
    }));
  }

  async recentResults(userId: UserId, limit: number): Promise<RecentResult[]> {
    const rows = await this.db.query<{
      item_id: ItemId;
      skill_id: SkillId;
      correct: boolean;
      hints_used: number;
      duration_ms: number;
      answered_at: Date;
    }>(
      `select item_id, skill_id, correct, hints_used, duration_ms, answered_at
         from attempts where user_id = $1
        order by answered_at desc, created_at desc
        limit $2`,
      [userId, limit],
    );
    return rows.map((row) => ({
      itemId: row.item_id,
      skillId: row.skill_id,
      correct: row.correct,
      hintsUsed: row.hints_used,
      durationMs: row.duration_ms,
      answeredAt: toIso(row.answered_at),
    }));
  }

  async countItemAttempts(userId: UserId, itemId: ItemId): Promise<number> {
    const row = await this.db.one<{ count: number }>(
      "select count(*)::int as count from attempts where user_id = $1 and item_id = $2",
      [userId, itemId],
    );
    return row.count;
  }

  async recordLessonCompletion(userId: UserId, lessonId: LessonId, durationMs: number, at: string): Promise<void> {
    await this.db.query(
      "insert into lesson_completions (user_id, lesson_id, duration_ms, completed_at) values ($1, $2, $3, $4)",
      [userId, lessonId, durationMs, at],
    );
  }

  async completedLessonIds(userId: UserId): Promise<LessonId[]> {
    const rows = await this.db.query<{ lesson_id: LessonId }>(
      "select distinct lesson_id from lesson_completions where user_id = $1",
      [userId],
    );
    return rows.map((row) => row.lesson_id);
  }
}
