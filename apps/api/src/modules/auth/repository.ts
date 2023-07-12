import type { UserId } from "@learnly/shared";
import { toIso, type Database } from "../../db/sql.js";

export interface RefreshTokenRecord {
  id: string;
  userId: UserId;
  familyId: string;
  expiresAt: string;
  rotatedAt: string | null;
  revokedAt: string | null;
}

export interface NewRefreshToken {
  userId: UserId;
  familyId: string;
  tokenHash: string;
  expiresAt: string;
  userAgent: string | null;
}

export interface RefreshTokenRepository {
  insert(token: NewRefreshToken): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /** Marks a live token as used. Returns false if it was already rotated or revoked. */
  markRotated(id: string, at: string): Promise<boolean>;
  /** Revokes every still-live token in a family. Returns how many were revoked. */
  revokeFamily(familyId: string, reason: string, at: string): Promise<number>;
}

interface RefreshTokenRow {
  id: string;
  user_id: UserId;
  family_id: string;
  expires_at: Date;
  rotated_at: Date | null;
  revoked_at: Date | null;
}

const COLUMNS = "id, user_id, family_id, expires_at, rotated_at, revoked_at";

function toRecord(row: RefreshTokenRow): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    familyId: row.family_id,
    expiresAt: toIso(row.expires_at),
    rotatedAt: toIso(row.rotated_at),
    revokedAt: toIso(row.revoked_at),
  };
}

export class PgRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: Database) {}

  async insert(token: NewRefreshToken): Promise<RefreshTokenRecord> {
    const row = await this.db.one<RefreshTokenRow>(
      `insert into refresh_tokens (user_id, family_id, token_hash, expires_at, user_agent)
       values ($1, $2, $3, $4, $5)
       returning ${COLUMNS}`,
      [token.userId, token.familyId, token.tokenHash, token.expiresAt, token.userAgent],
    );
    return toRecord(row);
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.db.maybeOne<RefreshTokenRow>(
      `select ${COLUMNS} from refresh_tokens where token_hash = $1`,
      [tokenHash],
    );
    return row ? toRecord(row) : null;
  }

  async markRotated(id: string, at: string): Promise<boolean> {
    // The WHERE clause makes rotation a compare-and-set: two concurrent refreshes with
    // the same token can't both succeed.
    const rows = await this.db.query(
      `update refresh_tokens set rotated_at = $2
        where id = $1 and rotated_at is null and revoked_at is null
        returning id`,
      [id, at],
    );
    return rows.length === 1;
  }

  async revokeFamily(familyId: string, reason: string, at: string): Promise<number> {
    const rows = await this.db.query(
      `update refresh_tokens set revoked_at = $3, revoked_reason = $2
        where family_id = $1 and revoked_at is null
        returning id`,
      [familyId, reason, at],
    );
    return rows.length;
  }
}
