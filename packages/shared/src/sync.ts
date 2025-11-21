import { z } from "zod";
import { attemptInputSchema, preferencesSchema } from "./schemas.js";

/**
 * Every write a device makes while offline is recorded as an operation in a local
 * outbox. Operations carry a client-generated id so the server can apply them
 * idempotently no matter how many times a flaky connection retries the batch.
 */
export const syncOperationSchema = z.discriminatedUnion("type", [
  z.object({
    opId: z.string().uuid(),
    type: z.literal("attempt.create"),
    createdAt: z.string().datetime(),
    payload: attemptInputSchema,
  }),
  z.object({
    opId: z.string().uuid(),
    type: z.literal("lesson.complete"),
    createdAt: z.string().datetime(),
    payload: z.object({ lessonId: z.string().uuid(), durationMs: z.number().int().min(0) }),
  }),
  z.object({
    opId: z.string().uuid(),
    type: z.literal("preferences.update"),
    createdAt: z.string().datetime(),
    payload: preferencesSchema,
  }),
]);
export type SyncOperation = z.infer<typeof syncOperationSchema>;
export type SyncOperationType = SyncOperation["type"];

export const syncPushSchema = z.object({
  deviceId: z.string().min(8).max(64),
  /** Server cursor from the last successful pull, or null on first sync. */
  since: z.string().nullable(),
  operations: z.array(syncOperationSchema).max(200),
});
export type SyncPushInput = z.infer<typeof syncPushSchema>;

export type SyncOpStatus = "applied" | "duplicate" | "rejected";

export interface SyncOpResult {
  opId: string;
  status: SyncOpStatus;
  reason?: string;
}

export interface SyncDelta<T> {
  upserted: T[];
  deletedIds: string[];
}

export interface SyncResponse {
  results: SyncOpResult[];
  cursor: string;
  serverTime: string;
  mastery: SyncDelta<import("./domain.js").SkillMastery>;
  lessons: SyncDelta<import("./domain.js").Lesson>;
  progress: { totalXp: number; streak: number; freezesAvailable: number };
}

/** Exponential backoff with full jitter, capped at five minutes. */
export function syncBackoffMs(failures: number, random: () => number = Math.random): number {
  const cap = 5 * 60_000;
  const base = Math.min(cap, 1000 * 2 ** Math.max(0, failures));
  return Math.round(base * (0.5 + random() * 0.5));
}

export const SYNC_RETENTION_DAYS = 30;

export function isExpiredOperation(op: SyncOperation, now = Date.now()): boolean {
  return now - Date.parse(op.createdAt) > SYNC_RETENTION_DAYS * 86_400_000;
}
