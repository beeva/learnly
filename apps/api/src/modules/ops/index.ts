import compression from "compression";
import { loadFeatureFlags, type FeatureFlags } from "../../config/features.js";
import type { FeatureModule } from "../../container.js";
import { createMetrics, type Metrics } from "../../lib/metrics.js";
import { catalogCacheHeaders } from "../../middleware/http-cache.js";
import { httpMetrics } from "../../middleware/http-metrics.js";
import type { AttemptSubmitter } from "../attempts/service.js";
import type { SyncRepository } from "../sync/repository.js";
import { opsRouter } from "./routes.js";

export interface Lifecycle {
  startedAt: string;
  /** Set on SIGTERM; readiness fails so traffic drains before the process exits. */
  shuttingDown: boolean;
}

export interface ReadinessProbe {
  check(): Promise<void>;
}

declare module "../../container.js" {
  interface Services {
    features: FeatureFlags;
    metrics: Metrics;
    lifecycle: Lifecycle;
    readinessProbe: ReadinessProbe;
  }
}

export const opsModule: FeatureModule = {
  name: "ops",
  rootRouter: opsRouter,
  register(container) {
    container
      .register("features", () => loadFeatureFlags())
      .register("metrics", () => createMetrics())
      .register("lifecycle", (c) => ({ startedAt: c.resolve("clock").now().toISOString(), shuttingDown: false }))
      .register("readinessProbe", (c) => ({ check: () => c.resolve("db").ping() }));
  },
  middleware: (container) => [
    httpMetrics(container.resolve("metrics")),
    // Lesson payloads are mostly prose and compress ~5x; skip tiny bodies.
    compression({ threshold: 1024 }),
    catalogCacheHeaders(),
  ],
};

/** Registered last so it can wrap services every other module has registered or decorated. */
export const opsInstrumentationModule: FeatureModule = {
  name: "ops-instrumentation",
  register(container) {
    container.decorate("attemptSubmitter", (inner, c): AttemptSubmitter => {
      const metrics = c.resolve("metrics");
      return {
        async submit(userId, input) {
          const outcome = await inner.submit(userId, input);
          if (!outcome.replayed) {
            metrics.attempts.inc({ kind: outcome.item.kind, correct: String(outcome.body.correct) });
          }
          return outcome;
        },
      };
    });
    container.decorate("syncRepository", (inner, c): SyncRepository => {
      const metrics = c.resolve("metrics");
      return {
        async claim(userId, op) {
          const claimed = await inner.claim(userId, op);
          metrics.syncOperations.inc({ status: claimed ? "claimed" : "replayed" });
          return claimed;
        },
        async reject(userId, op, reason) {
          await inner.reject(userId, op, reason);
          metrics.syncOperations.inc({ status: "rejected" });
        },
        find: (userId, opId) => inner.find(userId, opId),
        touchDevice: (userId, deviceId, at) => inner.touchDevice(userId, deviceId, at),
        masteryChangedSince: (userId, since) => inner.masteryChangedSince(userId, since),
      };
    });
  },
};
