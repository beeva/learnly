import client from "prom-client";
import type { Counter, Gauge, Histogram, Registry } from "prom-client";

export interface Metrics {
  registry: Registry;
  httpDuration: Histogram<"method" | "route" | "status">;
  attempts: Counter<"kind" | "correct">;
  syncOperations: Counter<"status">;
  analyticsEvents: Counter<"outcome">;
  jobDuration: Histogram<"job" | "status">;
  dbPool: Gauge<"state">;
}

/**
 * One registry per app instance (not prom-client's global default), so tests can build
 * many apps without "metric already registered" errors.
 */
export function createMetrics(): Metrics {
  const registry = new client.Registry();
  registry.setDefaultLabels({ service: "learnly-api" });
  client.collectDefaultMetrics({ register: registry });

  return {
    registry,
    // Buckets centred on our budgets: API p95 < 300 ms, lesson loads well under 2 s.
    httpDuration: new client.Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration by route template",
      labelNames: ["method", "route", "status"] as const,
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [registry],
    }),
    attempts: new client.Counter({
      name: "learnly_attempts_total",
      help: "Scored attempts by item kind and correctness",
      labelNames: ["kind", "correct"] as const,
      registers: [registry],
    }),
    syncOperations: new client.Counter({
      name: "learnly_sync_operations_total",
      help: "Offline operations processed by outcome",
      labelNames: ["status"] as const,
      registers: [registry],
    }),
    analyticsEvents: new client.Counter({
      name: "learnly_analytics_events_total",
      help: "Product analytics events received",
      labelNames: ["outcome"] as const,
      registers: [registry],
    }),
    jobDuration: new client.Histogram({
      name: "learnly_job_duration_seconds",
      help: "Nightly job duration",
      labelNames: ["job", "status"] as const,
      buckets: [1, 5, 15, 60, 300, 900],
      registers: [registry],
    }),
    dbPool: new client.Gauge({
      name: "learnly_db_pool_connections",
      help: "Postgres pool connections by state",
      labelNames: ["state"] as const,
      registers: [registry],
    }),
  };
}

export interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

/** Sample pool counters right before each scrape rather than on a timer. */
export async function renderMetrics(metrics: Metrics, pool?: PoolStats): Promise<string> {
  if (pool) {
    metrics.dbPool.set({ state: "total" }, pool.totalCount);
    metrics.dbPool.set({ state: "idle" }, pool.idleCount);
    metrics.dbPool.set({ state: "waiting" }, pool.waitingCount);
  }
  return metrics.registry.metrics();
}
