/**
 * Tiny, dependency-free migration runner.
 *
 *   tsx scripts/migrate.ts          apply pending migrations
 *   tsx scripts/migrate.ts status   list applied / pending migrations
 *
 * Each migration runs in its own transaction, under a Postgres advisory lock so two
 * deploying containers can never race. Checksums catch edits to applied files.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { MIGRATIONS } from "../src/db/migrations.js";

const LOCK_ID = 727_001;

export interface MigrationReport {
  applied: string[];
  pending: string[];
}

interface RunOptions {
  databaseUrl: string;
  directory?: string;
  dryRun?: boolean;
  log?: (message: string) => void;
}

const defaultDirectory = () =>
  process.env["MIGRATIONS_DIR"] ?? fileURLToPath(new URL("../migrations/", import.meta.url));

/** Normalise line endings so a Windows checkout produces the same checksum as CI. */
function checksum(sql: string): string {
  return createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
}

async function readMigration(directory: string, id: string): Promise<{ sql: string; checksum: string }> {
  const sql = await readFile(path.join(directory, `${id}.sql`), "utf8");
  return { sql, checksum: checksum(sql) };
}

export async function migrate({
  databaseUrl,
  directory = defaultDirectory(),
  dryRun = false,
  log = console.log,
}: RunOptions): Promise<MigrationReport> {
  const onDisk = (await readdir(directory)).filter((f) => f.endsWith(".sql")).map((f) => f.slice(0, -4));
  const unlisted = onDisk.filter((id) => !MIGRATIONS.includes(id));
  if (unlisted.length > 0) {
    throw new Error(`Migrations on disk but missing from src/db/migrations.ts: ${unlisted.join(", ")}`);
  }

  const client = new pg.Client({ connectionString: databaseUrl, application_name: "learnly-migrate" });
  await client.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [LOCK_ID]);
    await client.query(`
      create table if not exists schema_migrations (
        id          text primary key,
        checksum    text not null,
        applied_at  timestamptz not null default now()
      )`);
    const { rows } = await client.query<{ id: string; checksum: string }>(
      "select id, checksum from schema_migrations",
    );
    const appliedChecksums = new Map(rows.map((row) => [row.id, row.checksum]));
    const report: MigrationReport = { applied: [], pending: [] };

    for (const id of MIGRATIONS) {
      const migration = await readMigration(directory, id);
      const previous = appliedChecksums.get(id);
      if (previous !== undefined) {
        if (previous !== migration.checksum) {
          throw new Error(`Migration ${id} changed after it was applied. Add a new migration instead.`);
        }
        continue;
      }
      if (dryRun) {
        report.pending.push(id);
        continue;
      }
      const started = Date.now();
      await client.query("begin");
      try {
        await client.query(migration.sql);
        await client.query("insert into schema_migrations (id, checksum) values ($1, $2)", [
          id,
          migration.checksum,
        ]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Migration ${id} failed: ${(error as Error).message}`, { cause: error });
      }
      report.applied.push(id);
      log(`  applied ${id} (${Date.now() - started}ms)`);
    }
    return report;
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK_ID]).catch(() => undefined);
    await client.end();
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const command = process.argv[2] ?? "up";
  if (command === "status") {
    const report = await migrate({ databaseUrl, dryRun: true });
    const pending = new Set(report.pending);
    for (const id of MIGRATIONS) console.log(`${pending.has(id) ? "  pending" : "  applied"}  ${id}`);
    return;
  }
  if (command !== "up") throw new Error(`Unknown command "${command}". Use "up" or "status".`);
  console.log("Running migrations…");
  const report = await migrate({ databaseUrl });
  console.log(report.applied.length > 0 ? `Done: ${report.applied.length} applied.` : "Already up to date.");
}

const invokedDirectly = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
