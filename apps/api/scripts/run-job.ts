/**
 * Run nightly jobs by hand (backfills, debugging, a fresh staging database):
 *
 *   tsx scripts/run-job.ts                    run every job (if not already run today)
 *   tsx scripts/run-job.ts bkt-fit --force    run one job even if it ran recently
 */
import { pino } from "pino";
import { registerModules } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { createContainer } from "../src/container.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.filter((arg) => !arg.startsWith("--"));
  const config = loadConfig();
  const logger = pino({ level: config.LOG_LEVEL === "silent" ? "info" : config.LOG_LEVEL });
  const container = registerModules(createContainer({ config, logger }));

  try {
    const results = await container
      .resolve("nightlyScheduler")
      .runAll({ force, ...(only.length > 0 && !only.includes("all") ? { only } : {}) });
    for (const result of results) {
      console.log(`${result.status.padEnd(9)} ${result.job}  ${JSON.stringify(result.details)}`);
    }
    if (results.some((result) => result.status === "failed")) process.exitCode = 1;
  } finally {
    if (container.isResolved("db")) await container.resolve("db").close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
