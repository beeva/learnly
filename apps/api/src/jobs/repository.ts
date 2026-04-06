import type { ItemId, SkillId } from "@learnly/shared";
import type { Database } from "../db/sql.js";

export interface ItemCalibrationTarget {
  itemId: ItemId;
  authored: number;
  current: number;
  responses: number;
}

export interface CalibrationResponse {
  ability: number;
  correct: boolean;
}

export type JobStatus = "succeeded" | "failed";

export interface JobRepository {
  skillsWithAnswers(since: string): Promise<SkillId[]>;
  /** One chronological correct/incorrect sequence per learner, most active learners first. */
  answerSequences(skillId: SkillId, since: string, maxLearners: number): Promise<boolean[][]>;
  itemsWithResponses(since: string, minResponses: number): Promise<ItemCalibrationTarget[]>;
  responsesForItem(itemId: ItemId, since: string, limit: number): Promise<CalibrationResponse[]>;
  saveItemDifficulty(itemId: ItemId, difficulty: number, responses: number, at: string): Promise<void>;
  pruneSyncOperations(before: string): Promise<number>;
  pruneAnalyticsEvents(before: string): Promise<number>;
  /**
   * Start a run unless one is already running, or one succeeded within `minHoursBetween`
   * (another replica got there first). Returns the run id, or null to skip.
   */
  claimRun(job: string, at: string, minHoursBetween: number): Promise<number | null>;
  finishRun(id: number, status: JobStatus, details: Record<string, unknown>, at: string): Promise<void>;
}

export class PgJobRepository implements JobRepository {
  constructor(private readonly db: Database) {}

  async skillsWithAnswers(since: string): Promise<SkillId[]> {
    const rows = await this.db.query<{ skill_id: SkillId }>(
      "select distinct skill_id from attempts where answered_at >= $1",
      [since],
    );
    return rows.map((row) => row.skill_id);
  }

  async answerSequences(skillId: SkillId, since: string, maxLearners: number): Promise<boolean[][]> {
    const rows = await this.db.query<{ answers: boolean[] }>(
      `select array_agg(correct order by answered_at) as answers
         from attempts
        where skill_id = $1 and answered_at >= $2
        group by user_id
        order by count(*) desc
        limit $3`,
      [skillId, since, maxLearners],
    );
    return rows.map((row) => row.answers);
  }

  async itemsWithResponses(since: string, minResponses: number): Promise<ItemCalibrationTarget[]> {
    const rows = await this.db.query<{ id: ItemId; authored: number; current: number; responses: number }>(
      `select i.id, coalesce(i.authored_difficulty, i.difficulty) as authored, i.difficulty as current,
              count(a.id)::int as responses
         from items i
         join attempts a on a.item_id = i.id and a.answered_at >= $1
        where i.active
        group by i.id
       having count(a.id) >= $2`,
      [since, minResponses],
    );
    return rows.map((row) => ({ itemId: row.id, authored: row.authored, current: row.current, responses: row.responses }));
  }

  async responsesForItem(itemId: ItemId, since: string, limit: number): Promise<CalibrationResponse[]> {
    // First attempts only: retries after seeing the explanation would make items look easier.
    const rows = await this.db.query<{ ability_before: number; correct: boolean }>(
      `select distinct on (user_id) ability_before, correct
         from attempts
        where item_id = $1 and answered_at >= $2
        order by user_id, answered_at
        limit $3`,
      [itemId, since, limit],
    );
    return rows.map((row) => ({ ability: row.ability_before, correct: row.correct }));
  }

  async saveItemDifficulty(itemId: ItemId, difficulty: number, responses: number, at: string): Promise<void> {
    await this.db.query(
      `update items set difficulty = $2, calibration_responses = $3, calibrated_at = $4, updated_at = now()
        where id = $1`,
      [itemId, difficulty, responses, at],
    );
  }

  async pruneSyncOperations(before: string): Promise<number> {
    const rows = await this.db.query("delete from sync_operations where processed_at < $1 returning op_id", [before]);
    return rows.length;
  }

  async pruneAnalyticsEvents(before: string): Promise<number> {
    const rows = await this.db.query("delete from analytics_events where received_at < $1 returning id", [before]);
    return rows.length;
  }

  async claimRun(job: string, at: string, minHoursBetween: number): Promise<number | null> {
    // A run that has been "running" for hours died with its process; release it.
    await this.db.query(
      `update job_runs set status = 'failed', finished_at = $2,
              details = details || '{"error": "abandoned"}'::jsonb
        where job = $1 and status = 'running' and started_at < $2::timestamptz - interval '6 hours'`,
      [job, at],
    );
    const row = await this.db.maybeOne<{ id: number }>(
      `insert into job_runs (job, started_at, status)
       select $1, $2, 'running'
        where not exists (
          select 1 from job_runs
           where job = $1 and status = 'succeeded'
             and started_at > $2::timestamptz - make_interval(hours => $3::int))
       on conflict (job) where status = 'running' do nothing
       returning id`,
      [job, at, minHoursBetween],
    );
    return row?.id ?? null;
  }

  async finishRun(id: number, status: JobStatus, details: Record<string, unknown>, at: string): Promise<void> {
    await this.db.query("update job_runs set status = $2, details = $3, finished_at = $4 where id = $1", [
      id,
      status,
      JSON.stringify(details),
      at,
    ]);
  }
}
