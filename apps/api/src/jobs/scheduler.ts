import { SYNC_RETENTION_DAYS } from "@learnly/shared";
import type { FeatureModule } from "../container.js";
import type { Clock } from "../lib/clock.js";
import type { Logger } from "../lib/logger.js";
import type { Metrics } from "../lib/metrics.js";
import { runBktFit } from "./bkt-fit.js";
import { runDifficultyCalibration } from "./calibrate-difficulty.js";
import { PgJobRepository, type JobRepository } from "./repository.js";

export interface NightlyJob {
  name: string;
  run(): Promise<Record<string, unknown>>;
}

export interface JobRunResult {
  job: string;
  status: "succeeded" | "failed" | "skipped";
  details: Record<string, unknown>;
}

export interface SchedulerDeps {
  jobs: NightlyJob[];
  repository: JobRepository;
  clock: Clock;
  logger: Logger;
  metrics: Metrics;
  hourUtc: number;
}

/** Minimum gap between successful runs, so a second replica's timer doesn't rerun them. */
const MIN_HOURS_BETWEEN_RUNS = 20;

/**
 * Runs the nightly jobs once a day at `hourUtc`, on whichever replica claims them first.
 * Jobs run one after another (BKT fit, then calibration, then retention) and a failing
 * job never stops the next one.
 */
export class NightlyScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<JobRunResult[]> | null = null;

  constructor(private readonly deps: SchedulerDeps) {}

  /** Milliseconds until the next run, with up to five minutes of jitter between replicas. */
  msUntilNextRun(now: Date, jitterMs = Math.floor(Math.random() * 300_000)): number {
    const next = new Date(now);
    next.setUTCHours(this.deps.hourUtc, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime() + jitterMs;
  }

  start(): void {
    if (this.timer) return;
    const delay = this.msUntilNextRun(this.deps.clock.now());
    this.deps.logger.info({ inMinutes: Math.round(delay / 60_000) }, "nightly jobs scheduled");
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runAll().finally(() => this.start());
    }, delay);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  async runAll(options: { only?: string[]; force?: boolean } = {}): Promise<JobRunResult[]> {
    if (this.running) return this.running;
    this.running = this.runJobs(options).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runJobs({ only, force = false }: { only?: string[]; force?: boolean }): Promise<JobRunResult[]> {
    const results: JobRunResult[] = [];
    for (const job of this.deps.jobs) {
      if (only && !only.includes(job.name)) continue;
      const startedAt = this.deps.clock.now();
      const runId = await this.deps.repository.claimRun(job.name, startedAt.toISOString(), force ? 0 : MIN_HOURS_BETWEEN_RUNS);
      if (runId === null) {
        results.push({ job: job.name, status: "skipped", details: { reason: "already ran or running elsewhere" } });
        continue;
      }
      const stopTimer = this.deps.metrics.jobDuration.startTimer({ job: job.name });
      try {
        const details = await job.run();
        await this.deps.repository.finishRun(runId, "succeeded", details, this.deps.clock.now().toISOString());
        stopTimer({ status: "succeeded" });
        this.deps.logger.info({ job: job.name, ...details }, "nightly job succeeded");
        results.push({ job: job.name, status: "succeeded", details });
      } catch (error) {
        const details = { error: error instanceof Error ? error.message : String(error) };
        await this.deps.repository.finishRun(runId, "failed", details, this.deps.clock.now().toISOString());
        stopTimer({ status: "failed" });
        this.deps.logger.error({ err: error, job: job.name }, "nightly job failed");
        results.push({ job: job.name, status: "failed", details });
      }
    }
    return results;
  }
}

