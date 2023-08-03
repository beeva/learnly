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

