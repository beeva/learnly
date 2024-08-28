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

