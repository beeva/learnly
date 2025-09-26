import type { CourseId, ItemId, Response, SkillId, SkillMastery, StreakState, UserId } from "@learnly/shared";
import { toIso, type Database } from "../../db/sql.js";
import { toMastery } from "../attempts/repository.js";
import { NEW_LEARNER_FREEZES } from "../progress/repository.js";
import type { InsightAttempt } from "./compute.js";

export interface UserMastery extends SkillMastery {
  userId: UserId;
}

export interface InsightsRepository {
  attempts(userIds: UserId[], skillIds: SkillId[], from: string, to: string): Promise<InsightAttempt[]>;
  mastery(userIds: UserId[], skillIds: SkillId[]): Promise<UserMastery[]>;
  minutes(userIds: UserId[], fromDay: string, toDay: string): Promise<Map<UserId, number>>;
  streaks(userIds: UserId[]): Promise<Map<UserId, StreakState>>;
  lastActive(userIds: UserId[]): Promise<Map<UserId, string>>;
  completedLessons(userIds: UserId[], courseId: CourseId): Promise<Map<UserId, number>>;
  lessonCount(courseId: CourseId): Promise<number>;
}

/**
 * Reads for one classroom at a time (tens of students), so each query is bounded by the
 * member list and served by the (user_id, …) indexes.
 */
export class PgInsightsRepository implements InsightsRepository {
  constructor(private readonly db: Database) {}

  async attempts(userIds: UserId[], skillIds: SkillId[], from: string, to: string): Promise<InsightAttempt[]> {
    if (userIds.length === 0 || skillIds.length === 0) return [];
    const rows = await this.db.query<{
      user_id: UserId;
      item_id: ItemId;
      skill_id: SkillId;
      correct: boolean;
      response: Response;
      hints_used: number;
      duration_ms: number;
      answered_at: Date;
    }>(
      `select user_id, item_id, skill_id, correct, response, hints_used, duration_ms, answered_at
         from attempts
        where user_id = any($1::uuid[]) and skill_id = any($2::uuid[])
          and answered_at >= $3 and answered_at < $4
        order by answered_at`,
      [userIds, skillIds, from, to],
    );
    return rows.map((row) => ({
      userId: row.user_id,
      itemId: row.item_id,
      skillId: row.skill_id,
      correct: row.correct,
      response: row.response,
      hintsUsed: row.hints_used,
      durationMs: row.duration_ms,
      answeredAt: toIso(row.answered_at),
    }));
  }

  async mastery(userIds: UserId[], skillIds: SkillId[]): Promise<UserMastery[]> {
    if (userIds.length === 0 || skillIds.length === 0) return [];
    const rows = await this.db.query<Parameters<typeof toMastery>[0] & { user_id: UserId }>(
      `select user_id, skill_id, p_known, ability, band, attempts, last_practiced_at, due_at
         from skill_mastery
        where user_id = any($1::uuid[]) and skill_id = any($2::uuid[])`,
      [userIds, skillIds],
    );
    return rows.map((row) => ({ ...toMastery(row), userId: row.user_id }));
  }

  async minutes(userIds: UserId[], fromDay: string, toDay: string): Promise<Map<UserId, number>> {
    const rows = await this.db.query<{ user_id: UserId; seconds: number }>(
      `select user_id, sum(active_seconds)::int as seconds
         from daily_activity
        where user_id = any($1::uuid[]) and day between $2 and $3
        group by user_id`,
      [userIds, fromDay, toDay],
    );
    return new Map(rows.map((row) => [row.user_id, Math.round(row.seconds / 60)]));
  }

  async streaks(userIds: UserId[]): Promise<Map<UserId, StreakState>> {
    const rows = await this.db.query<{
      user_id: UserId;
      streak_current: number;
      streak_longest: number;
      last_active_day: string | null;
      freezes_available: number;
    }>(
      `select user_id, streak_current, streak_longest, last_active_day, freezes_available
         from user_progress where user_id = any($1::uuid[])`,
      [userIds],
    );
    return new Map(
      rows.map((row) => [
        row.user_id,
        {
          current: row.streak_current,
          longest: row.streak_longest,
          lastActiveDay: row.last_active_day,
          freezesAvailable: row.freezes_available ?? NEW_LEARNER_FREEZES,
        },
      ]),
    );
  }

  async lastActive(userIds: UserId[]): Promise<Map<UserId, string>> {
    const rows = await this.db.query<{ user_id: UserId; at: Date }>(
      `select user_id, max(answered_at) as at from attempts where user_id = any($1::uuid[]) group by user_id`,
      [userIds],
    );
    return new Map(rows.map((row) => [row.user_id, toIso(row.at)]));
  }

  async completedLessons(userIds: UserId[], courseId: CourseId): Promise<Map<UserId, number>> {
    const rows = await this.db.query<{ user_id: UserId; completed: number }>(
      `select lc.user_id, count(distinct lc.lesson_id)::int as completed
         from lesson_completions lc
         join lessons l on l.id = lc.lesson_id
         join skills s on s.id = l.skill_id
         join units u on u.id = s.unit_id
        where lc.user_id = any($1::uuid[]) and u.course_id = $2
        group by lc.user_id`,
      [userIds, courseId],
    );
    return new Map(rows.map((row) => [row.user_id, row.completed]));
  }

  async lessonCount(courseId: CourseId): Promise<number> {
    const row = await this.db.one<{ count: number }>(
      `select count(*)::int as count
         from lessons l join skills s on s.id = l.skill_id join units u on u.id = s.unit_id
        where u.course_id = $1`,
      [courseId],
    );
    return row.count;
  }
}
