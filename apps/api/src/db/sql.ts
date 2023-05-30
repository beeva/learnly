import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import type { Logger } from "../lib/logger.js";

// Keep DATE columns as 'YYYY-MM-DD' strings: converting them to JS Dates would shift
// learners' activity days by their server's timezone offset.
pg.types.setTypeParser(1082, (value: string) => value);
// COUNT(*) and bigserial ids arrive as int8; every value we read fits a JS number.
pg.types.setTypeParser(20, (value: string) => Number(value));

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]): Promise<T[]>;
}

/** Runs work atomically. Nested calls join the outer transaction. */
export interface TransactionRunner {
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

export interface DatabaseOptions {
  connectionString: string;
  max?: number;
  statementTimeoutMs?: number;
  logger?: Logger;
}

/**
 * A thin layer over `pg.Pool`: typed row helpers and transactions that propagate through
 * async context, so repositories never have to thread a client argument around — a
 * query issued anywhere inside `transaction()` runs on that transaction's connection.
 */
export class Database implements Queryable, TransactionRunner {
  readonly pool: Pool;
  private readonly context = new AsyncLocalStorage<PoolClient>();

  constructor(options: DatabaseOptions) {
    this.pool = new pg.Pool({
      connectionString: options.connectionString,
      max: options.max ?? 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: options.statementTimeoutMs ?? 10_000,
      application_name: "learnly-api",
    });
    this.pool.on("error", (err) => options.logger?.error({ err }, "idle postgres client errored"));
  }

  get inTransaction(): boolean {
    return this.context.getStore() !== undefined;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const client = this.context.getStore();
    const values = [...params];
    const result = client ? await client.query<T>(text, values) : await this.pool.query<T>(text, values);
    return result.rows;
  }

  async maybeOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  async one<T extends QueryResultRow = QueryResultRow>(text: string, params: readonly unknown[] = []): Promise<T> {
    const row = await this.maybeOne<T>(text, params);
    if (!row) throw new Error(`Expected a row from query: ${text.trim().split("\n")[0] ?? text}`);
    return row;
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) return work();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await this.context.run(client, work);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<void> {
    await this.pool.query("select 1");
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/** Postgres `unique_violation`, optionally for a specific constraint or index. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, constraint: violated } = error as { code?: unknown; constraint?: unknown };
  return code === "23505" && (constraint === undefined || violated === constraint);
}

export function toIso(value: Date | string): string;
export function toIso(value: Date | string | null): string | null;
export function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
