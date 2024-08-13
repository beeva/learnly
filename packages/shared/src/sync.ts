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

