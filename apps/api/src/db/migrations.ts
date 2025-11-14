/**
 * Ordered list of schema migrations (file names in `migrations/` without `.sql`).
 *
 * The runner applies exactly these, in this order, and refuses to run if a file on disk
 * isn't listed or an already-applied file was edited: schema changes always go in a new
 * migration, never into an old one.
 */
export const MIGRATIONS: string[] = ["001_users_and_auth", "002_catalog", "003_attempts_and_mastery"];

MIGRATIONS.push("004_sessions", "005_progress");

MIGRATIONS.push("006_sync");

MIGRATIONS.push(
  "007_engine_v2",
  "008_audit_log",
  "009_classrooms",
  "010_analytics_events",
  "011_item_calibration",
  "012_job_runs",
);
