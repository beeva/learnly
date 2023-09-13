import { z } from "zod";
import { GRADE_BANDS } from "./domain.js";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Mix letters and numbers");

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(60),
  role: z.enum(["student", "educator"]).default("student"),
  gradeBand: z.enum(GRADE_BANDS).nullable().default(null),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });

export const responseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("multiple_choice"), choiceId: z.string().min(1) }),
  z.object({ kind: z.literal("numeric"), value: z.number().finite() }),
  z.object({ kind: z.literal("short_text"), text: z.string().max(500) }),
  z.object({ kind: z.literal("ordering"), order: z.array(z.string()).min(2).max(12) }),
]);

export const attemptInputSchema = z.object({
  itemId: z.string().uuid(),
  sessionId: z.string().uuid().nullable().default(null),
  response: responseSchema,
  hintsUsed: z.number().int().min(0).max(5).default(0),
  durationMs: z.number().int().min(0).max(60 * 60 * 1000),
  /** Client-generated id so retried submissions are idempotent. */
  clientAttemptId: z.string().uuid().optional(),
  answeredAt: z.string().datetime().optional(),
});
export type AttemptInput = z.infer<typeof attemptInputSchema>;

