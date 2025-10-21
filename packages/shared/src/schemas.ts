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

export const startSessionSchema = z.object({
  courseId: z.string().uuid(),
  kind: z.enum(["diagnostic", "practice", "review"]),
  targetItems: z.number().int().min(3).max(30).optional(),
});
export type StartSessionInput = z.infer<typeof startSessionSchema>;

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const preferencesSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  dailyGoalMinutes: z.number().int().min(5).max(120).optional(),
  reducedMotion: z.boolean().optional(),
  soundEffects: z.boolean().optional(),
  locale: z.enum(["en", "es", "fil"]).optional(),
});
export type PreferencesInput = z.infer<typeof preferencesSchema>;

export const createClassroomSchema = z.object({
  name: z.string().trim().min(2).max(80),
  courseId: z.string().uuid(),
});

export const joinClassroomSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NP-Z2-9]{6}$/, "Join codes are 6 letters or numbers"),
});
