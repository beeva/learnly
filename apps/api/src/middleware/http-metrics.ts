import type { Request, RequestHandler } from "express";
import type { Metrics } from "../lib/metrics.js";

/**
 * Label by route *template* (`/v1/lessons/:id`), never the raw URL, so a million lesson
 * ids don't become a million time series.
 */
export function routeLabel(req: Request): string {
  const template = (req.route as { path?: unknown } | undefined)?.path;
  if (typeof template === "string") return `${req.baseUrl}${template}`;
  return "unmatched";
}

export function httpMetrics(metrics: Metrics): RequestHandler {
  return (req, res, next) => {
    const stop = metrics.httpDuration.startTimer();
    res.on("finish", () => {
      stop({ method: req.method, route: routeLabel(req), status: String(res.statusCode) });
    });
    next();
  };
}
