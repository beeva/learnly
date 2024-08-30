import * as SQLite from "expo-sqlite";

/**
 * The local store that makes Learnly work on a bus with no signal: cached
 * catalog, downloaded lessons and their items, mastery, and the outbox of writes
 * waiting to sync. Migrations are append-only and run inside a transaction, keyed
 * by SQLite's `user_version` pragma.
 */
export type Db = SQLite.SQLiteDatabase;

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const migrations: Migration[] = [];

function migration(version: number, name: string, sql: string): void {
  migrations.push({ version, name, sql });
}

migration(
  1,
  "initial",
  `
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS courses (
    slug TEXT PRIMARY KEY NOT NULL,
    id TEXT NOT NULL,
    course_json TEXT NOT NULL,
    units_json TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    fetched_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY NOT NULL,
    skill_id TEXT NOT NULL,
    course_slug TEXT,
    lesson_json TEXT NOT NULL,
    downloaded INTEGER NOT NULL DEFAULT 0,
    fetched_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY NOT NULL,
    skill_id TEXT NOT NULL,
    lesson_id TEXT,
    difficulty REAL NOT NULL,
    item_json TEXT NOT NULL,
    -- Learned from AttemptResult.correctResponse so the item can be scored offline.
    key_json TEXT,
    explanation TEXT
  );

  CREATE TABLE IF NOT EXISTS mastery (
    skill_id TEXT PRIMARY KEY NOT NULL,
    mastery_json TEXT NOT NULL,
    server_updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    op_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    op_json TEXT NOT NULL,
    -- Local-only context (skill, difficulty, correctness) used to replay optimistic mastery.
    meta_json TEXT,
    state TEXT NOT NULL DEFAULT 'pending',
    tries INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS outbox_state_seq ON outbox (state, seq);
  `,
);

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("learnly.db");
      await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
      await migrate(db);
      return db;
    })().catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export async function migrate(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let current = row?.user_version ?? 0;
  const pending = [...migrations].sort((a, b) => a.version - b.version).filter((m) => m.version > current);
  for (const m of pending) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    });
    current = m.version;
  }
  return current;
}

export function latestSchemaVersion(): number {
  return migrations.reduce((max, m) => Math.max(max, m.version), 0);
}

/* ----------------------------------------------------------------------------
 * Small JSON key/value helpers for singletons (profile, cursor, device id…).
 * ------------------------------------------------------------------------- */

export async function kvGet<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?", key);
  return row ? (JSON.parse(row.value) as T) : null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    JSON.stringify(value),
  );
}

export async function kvDelete(key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM kv WHERE key = ?", key);
}

/** Wipes learner data on sign-out so the next person on a shared tablet starts fresh. */
export async function clearLearnerData(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM mastery;
    DELETE FROM outbox;
    DELETE FROM kv WHERE key NOT IN ('deviceId');
  `);
}

