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

