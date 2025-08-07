import { randomUUID } from "expo-crypto";
import {
  syncOperationSchema,
  type AttemptInput,
  type PreferencesInput,
  type SyncOperation,
  type SyncOpResult,
} from "@learnly/shared";
import { getDb } from "../db/schema";

/** Matches the server's `syncPushSchema` limit. */
export const MAX_BATCH = 200;

export type OutboxState = "pending" | "inflight" | "rejected" | "dead";

/** Local-only context stored next to an attempt so mastery can be replayed optimistically. */
export interface AttemptMeta {
  kind: "attempt";
  skillId: string;
  difficulty: number;
  /** null when the answer key isn't cached yet; the server will score it on sync. */
  correct: boolean | null;
  hintsUsed: number;
  answeredAt: string;
}

export type OutboxMeta = AttemptMeta | { kind: "lesson"; lessonId: string; minutes: number } | { kind: "preferences" };

export interface OutboxEntry {
  seq: number;
  op: SyncOperation;
  meta: OutboxMeta | null;
  state: OutboxState;
  tries: number;
  lastError: string | null;
  createdAt: string;
}

interface OutboxRow {
  seq: number;
  op_json: string;
  meta_json: string | null;
  state: OutboxState;
  tries: number;
  last_error: string | null;
  created_at: string;
}

function toEntry(row: OutboxRow): OutboxEntry {
  return {
    seq: row.seq,
    op: JSON.parse(row.op_json) as SyncOperation,
    meta: row.meta_json ? (JSON.parse(row.meta_json) as OutboxMeta) : null,
    state: row.state,
    tries: row.tries,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

/* ----------------------------------------------------------------------------
 * Operation builders
 * ------------------------------------------------------------------------- */

export function attemptOperation(payload: AttemptInput, now = new Date()): SyncOperation {
  return { opId: randomUUID(), type: "attempt.create", createdAt: now.toISOString(), payload };
}

export function lessonCompleteOperation(lessonId: string, durationMs: number, now = new Date()): SyncOperation {
  return {
    opId: randomUUID(),
    type: "lesson.complete",
    createdAt: now.toISOString(),
    payload: { lessonId, durationMs: Math.max(0, Math.round(durationMs)) },
  };
}

export function preferencesOperation(payload: PreferencesInput, now = new Date()): SyncOperation {
  return { opId: randomUUID(), type: "preferences.update", createdAt: now.toISOString(), payload };
}

/* ----------------------------------------------------------------------------
 * Pure helpers (unit tested)
 * ------------------------------------------------------------------------- */

/**
 * Several preference changes made offline collapse into one operation carrying
 * the merged, latest-wins payload. Attempts and lesson completions are never
 * compacted — each one is evidence the server needs.
 */
export function compactOperations(entries: Pick<OutboxEntry, "seq" | "op">[]): {
  keep: { seq: number; op: SyncOperation }[];
  dropSeqs: number[];
} {
  const prefs = entries.filter((e) => e.op.type === "preferences.update").sort((a, b) => a.seq - b.seq);
  if (prefs.length < 2) return { keep: [], dropSeqs: [] };
  const last = prefs[prefs.length - 1]!;
  const merged = prefs.reduce<PreferencesInput>(
    (acc, e) => (e.op.type === "preferences.update" ? { ...acc, ...e.op.payload } : acc),
    {},
  );
  return {
    keep: [{ seq: last.seq, op: { ...last.op, type: "preferences.update", payload: merged } as SyncOperation }],
    dropSeqs: prefs.slice(0, -1).map((e) => e.seq),
  };
}

/** Splits server results into rows to delete and rows to park as rejected. */
export function partitionResults(results: SyncOpResult[]): {
  done: string[];
  rejected: { opId: string; reason: string }[];
} {
  const done: string[] = [];
  const rejected: { opId: string; reason: string }[] = [];
  for (const r of results) {
    if (r.status === "rejected") rejected.push({ opId: r.opId, reason: r.reason ?? "rejected" });
    else done.push(r.opId);
  }
  return { done, rejected };
}

/* ----------------------------------------------------------------------------
 * Change notifications (sync engine schedules a flush; UI shows pending counts)
 * ------------------------------------------------------------------------- */

export type OutboxEvent = { type: "enqueued"; op: SyncOperation; meta: OutboxMeta | null } | { type: "changed" };
const listeners = new Set<(event: OutboxEvent) => void>();

export function subscribeOutbox(listener: (event: OutboxEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(event: OutboxEvent) {
  for (const listener of listeners) listener(event);
}

/* ----------------------------------------------------------------------------
 * SQLite-backed operations
 * ------------------------------------------------------------------------- */

export async function enqueue(op: SyncOperation, meta: OutboxMeta | null = null): Promise<void> {
  // Validate at the edge: a malformed op would poison every future batch.
  const valid = syncOperationSchema.parse(op);
  const db = await getDb();
  await db.runAsync(
    "INSERT OR IGNORE INTO outbox (op_id, type, op_json, meta_json, state, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
    valid.opId,
    valid.type,
    JSON.stringify(valid),
    meta ? JSON.stringify(meta) : null,
    valid.createdAt,
  );
  notify({ type: "enqueued", op: valid, meta });
}

/** Claims up to `limit` pending operations, oldest first, marking them in flight. */
export async function takeBatch(limit = MAX_BATCH): Promise<OutboxEntry[]> {
  const db = await getDb();
  let rows: OutboxRow[] = [];
  await db.withTransactionAsync(async () => {
    rows = await db.getAllAsync<OutboxRow>(
      "SELECT seq, op_json, meta_json, state, tries, last_error, created_at FROM outbox WHERE state = 'pending' ORDER BY seq LIMIT ?",
      Math.min(limit, MAX_BATCH),
    );
    if (rows.length) {
      await db.runAsync(
        `UPDATE outbox SET state = 'inflight', tries = tries + 1 WHERE seq IN (${rows.map(() => "?").join(",")})`,
        ...rows.map((r) => r.seq),
      );
    }
  });
  return rows.map((r) => toEntry({ ...r, state: "inflight", tries: r.tries + 1 }));
}

/** Applies server results. Ops the server didn't mention go back to pending. */
export async function settle(sentOpIds: string[], results: SyncOpResult[]): Promise<void> {
  const db = await getDb();
  const { done, rejected } = partitionResults(results);
  const mentioned = new Set(results.map((r) => r.opId));
  const unmentioned = sentOpIds.filter((id) => !mentioned.has(id));
  await db.withTransactionAsync(async () => {
    for (const opId of done) await db.runAsync("DELETE FROM outbox WHERE op_id = ?", opId);
    for (const r of rejected) {
      await db.runAsync("UPDATE outbox SET state = 'rejected', last_error = ? WHERE op_id = ?", r.reason, r.opId);
    }
    for (const opId of unmentioned) {
      await db.runAsync("UPDATE outbox SET state = 'pending' WHERE op_id = ? AND state = 'inflight'", opId);
    }
  });
  notify({ type: "changed" });
}

/** Returns in-flight ops to the queue after a failed push. */
export async function release(opIds: string[], error: string): Promise<void> {
  if (opIds.length === 0) return;
  const db = await getDb();
  await db.runAsync(
    `UPDATE outbox SET state = 'pending', last_error = ? WHERE state = 'inflight' AND op_id IN (${opIds.map(() => "?").join(",")})`,
    error,
    ...opIds,
  );
  notify({ type: "changed" });
}

/** After a crash mid-push, in-flight ops are safe to resend: the server dedupes by opId. */
export async function recoverInflight(): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync("UPDATE outbox SET state = 'pending' WHERE state = 'inflight'");
  return result.changes;
}

export async function compact(): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync<OutboxRow>(
    "SELECT seq, op_json, meta_json, state, tries, last_error, created_at FROM outbox WHERE state = 'pending' AND type = 'preferences.update'",
  );
  const { keep, dropSeqs } = compactOperations(rows.map(toEntry));
  if (dropSeqs.length === 0) return 0;
  await db.withTransactionAsync(async () => {
    for (const k of keep) await db.runAsync("UPDATE outbox SET op_json = ? WHERE seq = ?", JSON.stringify(k.op), k.seq);
    await db.runAsync(`DELETE FROM outbox WHERE seq IN (${dropSeqs.map(() => "?").join(",")})`, ...dropSeqs);
  });
  return dropSeqs.length;
}

export async function counts(): Promise<Record<OutboxState, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ state: OutboxState; n: number }>(
    "SELECT state, COUNT(*) AS n FROM outbox GROUP BY state",
  );
  const result: Record<OutboxState, number> = { pending: 0, inflight: 0, rejected: 0, dead: 0 };
  for (const r of rows) result[r.state] = r.n;
  return result;
}

/** Attempts the server hasn't confirmed yet, oldest first, for optimistic mastery replay. */
export async function unconfirmedAttempts(): Promise<AttemptMeta[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ meta_json: string }>(
    "SELECT meta_json FROM outbox WHERE type = 'attempt.create' AND state IN ('pending', 'inflight') AND meta_json IS NOT NULL ORDER BY seq",
  );
  return rows
    .map((r) => JSON.parse(r.meta_json) as OutboxMeta)
    .filter((m): m is AttemptMeta => m.kind === "attempt");
}

/** Lesson completions still waiting to sync, so progress can count them locally. */
export async function unconfirmedLessonMinutes(sinceIso: string): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ meta_json: string }>(
    "SELECT meta_json FROM outbox WHERE type = 'lesson.complete' AND state IN ('pending', 'inflight') AND created_at >= ? AND meta_json IS NOT NULL",
    sinceIso,
  );
  return rows.reduce((sum, r) => {
    const meta = JSON.parse(r.meta_json) as OutboxMeta;
    return sum + (meta.kind === "lesson" ? meta.minutes : 0);
  }, 0);
}

export interface DeadLetter {
  opId: string;
  type: SyncOperation["type"];
  createdAt: string;
  reason: string;
  deadAt: string;
  meta: OutboxMeta | null;
}

/** Moves operations out of the retry loop without deleting the learner's work. */
export async function moveToDeadLetter(opIds: string[], reason: string, now = new Date()): Promise<void> {
  if (opIds.length === 0) return;
  const db = await getDb();
  await db.runAsync(
    `UPDATE outbox SET state = 'dead', dead_reason = ?, dead_at = ? WHERE op_id IN (${opIds.map(() => "?").join(",")})`,
    reason,
    now.toISOString(),
    ...opIds,
  );
  notify({ type: "changed" });
}

export async function listDeadLetters(): Promise<DeadLetter[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    op_json: string;
    meta_json: string | null;
    dead_reason: string | null;
    last_error: string | null;
    dead_at: string | null;
    created_at: string;
  }>(
    "SELECT op_json, meta_json, dead_reason, last_error, dead_at, created_at FROM outbox WHERE state IN ('dead', 'rejected') ORDER BY seq DESC",
  );
  return rows.map((r) => {
    const op = JSON.parse(r.op_json) as SyncOperation;
    return {
      opId: op.opId,
      type: op.type,
      createdAt: r.created_at,
      reason: r.dead_reason ?? r.last_error ?? "rejected",
      deadAt: r.dead_at ?? r.created_at,
      meta: r.meta_json ? (JSON.parse(r.meta_json) as OutboxMeta) : null,
    };
  });
}

/**
 * Retrying re-stamps `createdAt` so an expired operation gets a fresh retention
 * window; the opId is kept, so the server still dedupes if it had applied it.
 */
export async function retryDeadLetter(opId: string, now = new Date()): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ op_json: string }>("SELECT op_json FROM outbox WHERE op_id = ?", opId);
  if (!row) return;
  const op = { ...(JSON.parse(row.op_json) as SyncOperation), createdAt: now.toISOString() } as SyncOperation;
  await db.runAsync(
    "UPDATE outbox SET state = 'pending', op_json = ?, tries = 0, dead_reason = NULL, dead_at = NULL, last_error = NULL WHERE op_id = ?",
    JSON.stringify(op),
    opId,
  );
  notify({ type: "changed" });
}

export async function discardDeadLetter(opId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM outbox WHERE op_id = ? AND state IN ('dead', 'rejected')", opId);
  notify({ type: "changed" });
}

