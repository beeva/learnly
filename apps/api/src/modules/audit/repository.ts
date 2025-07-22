import type { UserId } from "@learnly/shared";
import type { Database } from "../../db/sql.js";

export interface AuditRecord {
  occurredAt: string;
  actorId: UserId | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditRepository {
  append(record: AuditRecord): Promise<void>;
}

export class PgAuditRepository implements AuditRepository {
  constructor(private readonly db: Database) {}

  async append(record: AuditRecord): Promise<void> {
    await this.db.query(
      `insert into audit_log (occurred_at, actor_id, action, target_type, target_id, request_id, ip, user_agent, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        record.occurredAt,
        record.actorId,
        record.action,
        record.targetType,
        record.targetId,
        record.requestId,
        record.ip,
        record.userAgent,
        JSON.stringify(record.metadata),
      ],
    );
  }
}
