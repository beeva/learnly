import type {
  CourseId,
  DiagnosticSummary,
  ItemId,
  Session,
  SessionId,
  SessionKind,
  SkillId,
  UserId,
} from "@learnly/shared";
import { toIso, type Database } from "../../db/sql.js";

export interface SessionRecord extends Session {
  targetItems: number;
  summary: DiagnosticSummary | null;
}

export interface NewSession {
  userId: UserId;
  courseId: CourseId;
  kind: SessionKind;
  targetItems: number;
  startedAt: string;
}

/** One answered item within a session, oldest first. */
export interface SessionAnswer {
  itemId: ItemId;
  skillId: SkillId;
  correct: boolean;
  answeredAt: string;
}

export interface SessionRepository {
  create(session: NewSession): Promise<SessionRecord>;
  find(id: SessionId): Promise<SessionRecord | null>;
  recordAnswer(id: SessionId, correct: boolean): Promise<void>;
  /** Idempotent: completing twice keeps the first completion time and summary. */
  complete(id: SessionId, at: string, summary: DiagnosticSummary | null): Promise<SessionRecord>;
  answers(id: SessionId): Promise<SessionAnswer[]>;
  hasCompleted(userId: UserId, courseId: CourseId, kind: SessionKind): Promise<boolean>;
}

interface SessionRow {
  id: SessionId;
  user_id: UserId;
  course_id: CourseId;
  kind: SessionKind;
  target_items: number;
  started_at: Date;
  completed_at: Date | null;
  items_answered: number;
  items_correct: number;
  summary: DiagnosticSummary | null;
}

const COLUMNS =
  "id, user_id, course_id, kind, target_items, started_at, completed_at, items_answered, items_correct, summary";

function toRecord(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    kind: row.kind,
    startedAt: toIso(row.started_at),
    completedAt: toIso(row.completed_at),
    itemsAnswered: row.items_answered,
    itemsCorrect: row.items_correct,
    targetItems: row.target_items,
    summary: row.summary,
  };
}

export class PgSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async create(session: NewSession): Promise<SessionRecord> {
    const row = await this.db.one<SessionRow>(
      `insert into sessions (user_id, course_id, kind, target_items, started_at)
       values ($1, $2, $3, $4, $5)
       returning ${COLUMNS}`,
      [session.userId, session.courseId, session.kind, session.targetItems, session.startedAt],
    );
    return toRecord(row);
  }

  async find(id: SessionId): Promise<SessionRecord | null> {
    const row = await this.db.maybeOne<SessionRow>(`select ${COLUMNS} from sessions where id = $1`, [id]);
    return row ? toRecord(row) : null;
  }

  async recordAnswer(id: SessionId, correct: boolean): Promise<void> {
    await this.db.query(
      `update sessions
          set items_answered = items_answered + 1,
              items_correct = items_correct + case when $2 then 1 else 0 end
        where id = $1`,
      [id, correct],
    );
  }

  async complete(id: SessionId, at: string, summary: DiagnosticSummary | null): Promise<SessionRecord> {
    const row = await this.db.one<SessionRow>(
      `update sessions
          set completed_at = coalesce(completed_at, $2),
              summary = coalesce(summary, $3::jsonb)
        where id = $1
        returning ${COLUMNS}`,
      [id, at, summary === null ? null : JSON.stringify(summary)],
    );
    return toRecord(row);
  }

  async answers(id: SessionId): Promise<SessionAnswer[]> {
    const rows = await this.db.query<{ item_id: ItemId; skill_id: SkillId; correct: boolean; answered_at: Date }>(
      `select item_id, skill_id, correct, answered_at
         from attempts
        where session_id = $1
        order by answered_at, created_at`,
      [id],
    );
    return rows.map((row) => ({
      itemId: row.item_id,
      skillId: row.skill_id,
      correct: row.correct,
      answeredAt: toIso(row.answered_at),
    }));
  }

  async hasCompleted(userId: UserId, courseId: CourseId, kind: SessionKind): Promise<boolean> {
    const row = await this.db.maybeOne(
      `select 1 from sessions
        where user_id = $1 and course_id = $2 and kind = $3 and completed_at is not null
        limit 1`,
      [userId, courseId, kind],
    );
    return row !== null;
  }
}
