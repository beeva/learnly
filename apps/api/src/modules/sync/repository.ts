import type { SkillMastery, SyncOperationType, UserId } from "@learnly/shared";
import type { Database } from "../../db/sql.js";
import { toMastery } from "../attempts/repository.js";

export interface OperationRef {
  opId: string;
  deviceId: string;
  type: SyncOperationType;
  createdAt: string;
}

export interface OperationRecord {
  status: "applied" | "rejected";
  reason: string | null;
}

export interface SyncRepository {
  /** Claim an operation for this learner. False if it was already processed. */
  claim(userId: UserId, op: OperationRef): Promise<boolean>;
  find(userId: UserId, opId: string): Promise<OperationRecord | null>;
  reject(userId: UserId, op: OperationRef, reason: string): Promise<void>;
  touchDevice(userId: UserId, deviceId: string, at: string): Promise<void>;
  masteryChangedSince(userId: UserId, since: string | null): Promise<SkillMastery[]>;
}

export class PgSyncRepository implements SyncRepository {
  constructor(private readonly db: Database) {}

  async claim(userId: UserId, op: OperationRef): Promise<boolean> {
    const rows = await this.db.query(
      `insert into sync_operations (user_id, op_id, device_id, type, status, client_created_at)
       values ($1, $2, $3, $4, 'applied', $5)
       on conflict (user_id, op_id) do nothing
       returning op_id`,
      [userId, op.opId, op.deviceId, op.type, op.createdAt],
    );
    return rows.length === 1;
  }

  async find(userId: UserId, opId: string): Promise<OperationRecord | null> {
    return this.db.maybeOne<OperationRecord>(
      "select status, reason from sync_operations where user_id = $1 and op_id = $2",
      [userId, opId],
    );
  }

  async reject(userId: UserId, op: OperationRef, reason: string): Promise<void> {
    await this.db.query(
      `insert into sync_operations (user_id, op_id, device_id, type, status, reason, client_created_at)
       values ($1, $2, $3, $4, 'rejected', $5, $6)
       on conflict (user_id, op_id) do nothing`,
      [userId, op.opId, op.deviceId, op.type, reason.slice(0, 500), op.createdAt],
    );
  }

  async touchDevice(userId: UserId, deviceId: string, at: string): Promise<void> {
    await this.db.query(
      `insert into devices (user_id, device_id, first_seen_at, last_sync_at) values ($1, $2, $3, $3)
       on conflict (user_id, device_id) do update set last_sync_at = excluded.last_sync_at`,
      [userId, deviceId, at],
    );
  }

  async masteryChangedSince(userId: UserId, since: string | null): Promise<SkillMastery[]> {
    const rows = await this.db.query<Parameters<typeof toMastery>[0]>(
      `select skill_id, p_known, ability, band, attempts, last_practiced_at, due_at
         from skill_mastery
        where user_id = $1 and ($2::timestamptz is null or updated_at > $2::timestamptz)
        order by updated_at`,
      [userId, since],
    );
    return rows.map(toMastery);
  }
}
