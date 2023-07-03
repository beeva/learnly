import type { Request, RequestHandler } from "express";
import { rateLimited } from "../lib/errors.js";

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** How long until one more request would be allowed (0 when allowed). */
  retryAfterMs: number;
  /** How long until the bucket is full again. */
  resetMs: number;
}

/**
 * Classic token bucket: holds up to `capacity` tokens and refills continuously. Bursts
 * (a lesson loading its items in parallel) are fine; sustained hammering is not.
 */
export class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  constructor(
    readonly capacity: number,
    readonly refillPerMs: number,
    now: number,
  ) {
    this.tokens = capacity;
    this.updatedAt = now;
  }

  private refill(now: number): void {
    const elapsed = Math.max(0, now - this.updatedAt);
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.updatedAt = now;
  }

  take(now: number, cost = 1): RateLimitDecision {
    this.refill(now);
    const allowed = this.tokens >= cost;
    if (allowed) this.tokens -= cost;
    const missing = Math.max(0, cost - this.tokens);
    return {
      allowed,
      limit: this.capacity,
      remaining: Math.floor(this.tokens),
      retryAfterMs: allowed ? 0 : Math.ceil(missing / this.refillPerMs),
      resetMs: Math.ceil((this.capacity - this.tokens) / this.refillPerMs),
    };
  }

  isFull(now: number): boolean {
    this.refill(now);
    return this.tokens >= this.capacity;
  }
}

export interface RateLimiterOptions {
  capacity: number;
  refillPerSecond: number;
  /** Upper bound on tracked keys so a spray of spoofed IPs can't exhaust memory. */
  maxKeys?: number;
  now?: () => number;
}

/** One bucket per key (IP address, user id…), with bounded memory. */
export class RateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly maxKeys: number;
  private readonly now: () => number;

  constructor(private readonly options: RateLimiterOptions) {
    this.maxKeys = options.maxKeys ?? 50_000;
    this.now = options.now ?? Date.now;
  }

  static perMinute(requests: number, options: Omit<RateLimiterOptions, "capacity" | "refillPerSecond"> = {}) {
    return new RateLimiter({ ...options, capacity: requests, refillPerSecond: requests / 60 });
  }

  get size(): number {
    return this.buckets.size;
  }

  consume(key: string, cost = 1): RateLimitDecision {
    const now = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) this.sweep(now);
      bucket = new TokenBucket(this.options.capacity, this.options.refillPerSecond / 1000, now);
      this.buckets.set(key, bucket);
    }
    return bucket.take(now, cost);
  }

  /** Forget buckets that have fully refilled; if still over budget, drop the oldest. */
  sweep(now = this.now()): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.isFull(now)) this.buckets.delete(key);
    }
    const overflow = this.buckets.size - Math.floor(this.maxKeys * 0.9);
    if (overflow <= 0) return;
    let dropped = 0;
    for (const key of this.buckets.keys()) {
      if (dropped++ >= overflow) break;
      this.buckets.delete(key);
    }
  }
}

export type RateLimitKey = (req: Request) => string;

export const byIp: RateLimitKey = (req) => req.ip ?? req.socket.remoteAddress ?? "unknown";

/**
 * Sets the IETF draft `RateLimit-*` headers on every response and rejects with a 429 and
 * `Retry-After` once the bucket is empty. The limiter is resolved per request so each
 * app instance (and each test) has its own buckets.
 */
export function rateLimit(limiterFor: (req: Request) => RateLimiter, keyOf: RateLimitKey = byIp): RequestHandler {
  return (req, res, next) => {
    const decision = limiterFor(req).consume(keyOf(req));
    res.setHeader("RateLimit-Limit", String(decision.limit));
    res.setHeader("RateLimit-Remaining", String(decision.remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(decision.resetMs / 1000)));
    if (decision.allowed) {
      next();
      return;
    }
    const retryAfter = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    next(rateLimited(retryAfter));
  };
}
