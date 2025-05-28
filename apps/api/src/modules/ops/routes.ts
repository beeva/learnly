import { timingSafeEqual } from "node:crypto";
import express from "express";
import { asyncHandler } from "../../lib/http.js";
import { renderMetrics } from "../../lib/metrics.js";

export const opsRouter = express.Router();

const READINESS_TIMEOUT_MS = 2_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Liveness (`/healthz`) only says the process is up. Readiness also checks we can reach
 * Postgres and aren't draining, so the load balancer routes around a sick task instead
 * of restarting a healthy one during a database blip.
 */
opsRouter.get(
  "/readyz",
  asyncHandler(async (req, res) => {
    const lifecycle = req.container.resolve("lifecycle");
    if (lifecycle.shuttingDown) {
      res.status(503).json({ status: "draining" });
      return;
    }
    try {
      await withTimeout(req.container.resolve("readinessProbe").check(), READINESS_TIMEOUT_MS);
      res.json({ status: "ready", checks: { database: "ok" } });
    } catch (error) {
      req.log.warn({ err: error }, "readiness check failed");
      res.status(503).json({ status: "unavailable", checks: { database: "failing" } });
    }
  }),
);

function tokenMatches(expected: string, header: string | undefined): boolean {
  const presented = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

opsRouter.get(
  "/metrics",
  asyncHandler(async (req, res) => {
    const { METRICS_TOKEN } = req.container.resolve("features");
    if (METRICS_TOKEN && !tokenMatches(METRICS_TOKEN, req.get("authorization"))) {
      res.status(401).type("text/plain").send("metrics token required\n");
      return;
    }
    const metrics = req.container.resolve("metrics");
    const pool = req.container.isResolved("db") ? req.container.resolve("db").pool : undefined;
    res.set("Content-Type", metrics.registry.contentType);
    res.set("Cache-Control", "no-store");
    res.send(await renderMetrics(metrics, pool));
  }),
);
