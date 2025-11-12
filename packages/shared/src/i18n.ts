/**
 * Encouragement messages are keyed rather than hard-coded so each client can render
 * them in the learner's language. Wording is deliberately warm and specific —
 * never "Wrong!", always something that keeps a student trying.
 */
export const ENCOURAGEMENT = {
  correct_streak: "You're on a roll — {count} in a row!",
  correct_after_hint: "Nice work using that hint.",
  correct_hard: "That was a tough one, and you got it.",
  correct: "Correct!",
  incorrect_close: "So close — check the last step.",
  incorrect_first: "Not quite. Let's look at it together.",
  incorrect_again: "Mistakes are how brains grow. Here's another way to see it.",
  mastered: "You've mastered {skill}!",
  level_up: "Level {level}! Keep going.",
} as const;

export type EncouragementKey = keyof typeof ENCOURAGEMENT;

export function formatMessage(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export const LOCALES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fil", label: "Filipino" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];

export function resolveLocale(requested: string | null | undefined): LocaleCode {
  const short = (requested ?? "").toLowerCase().split(/[-_]/)[0];
  return (LOCALES.find((l) => l.code === short)?.code ?? "en") as LocaleCode;
}
