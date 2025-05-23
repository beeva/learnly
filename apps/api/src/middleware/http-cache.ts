import type { RequestHandler } from "express";

interface CacheRule {
  pattern: RegExp;
  /** Cache-Control value for successful GET/HEAD responses. */
  policy: string;
}

/**
 * Catalog content is the same for every learner and changes only when we publish, so it
 * can be cached aggressively at the CDN and in the app. Combined with Express' ETags
 * (revalidation answers 304 with no body), repeat lesson opens cost a few hundred bytes —
 * a big part of keeping lesson loads under the 2 second budget on school wifi.
 */
const RULES: CacheRule[] = [
  { pattern: /^\/v1\/lessons\/[0-9a-f-]{36}$/i, policy: "public, max-age=300, stale-while-revalidate=86400" },
  { pattern: /^\/v1\/skills\/[0-9a-f-]{36}\/lessons$/i, policy: "public, max-age=300, stale-while-revalidate=86400" },
  { pattern: /^\/v1\/courses(\/[a-z0-9-]+)?$/i, policy: "public, max-age=120, stale-while-revalidate=3600" },
];

export function catalogCacheHeaders(): RequestHandler {
  return (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") {
      const rule = RULES.find((candidate) => candidate.pattern.test(req.path));
      // Learner-specific endpoints (progress, sessions…) must never be cached by shared caches.
      res.setHeader("Cache-Control", rule ? rule.policy : "private, no-store");
      if (rule) res.setHeader("Vary", "Accept-Encoding");
    } else {
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  };
}
