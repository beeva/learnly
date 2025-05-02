import { z } from "zod";

const flag = z
  .enum(["true", "false", "1", "0", "yes", "no"])
  .transform((value) => value === "true" || value === "1" || value === "yes");

/** Empty strings in .env files mean "not set". */
const optionalSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(16).optional(),
);

/** Operational settings that arrived with engine v2, nightly jobs and observability. */
export const featureFlagsSchema = z.object({
  ENGINE_VERSION: z.enum(["v1", "v2"]).default("v2"),
  JOBS_ENABLED: flag.default("true"),
  NIGHTLY_JOBS_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(3),
  METRICS_TOKEN: optionalSecret,
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15_000),
});

export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

export function loadFeatureFlags(source: NodeJS.ProcessEnv = process.env): FeatureFlags {
  const parsed = featureFlagsSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid feature configuration: ${problems}`);
  }
  return parsed.data;
}
