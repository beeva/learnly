import { z } from "zod";

const port = z.coerce.number().int().min(1).max(65_535);

const csv = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

/**
 * Every setting the API reads from the environment. Parsing happens once at boot so a
 * typo in a deployment fails fast with a readable message instead of at 3am.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: port.default(4000),
  HOST: z.string().min(1).default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  DATABASE_URL: z.string().url().default("postgres://learnly:learnly@localhost:5432/learnly"),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ISSUER: z.string().min(1).default("learnly-api"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(180).default(30),

  CORS_ORIGINS: csv.default("http://localhost:5173"),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(240),
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const config = parsed.data;
  if (config.NODE_ENV === "production" && config.JWT_SECRET.startsWith("dev-")) {
    throw new Error("Refusing to start in production with the development JWT secret");
  }
  return config;
}
