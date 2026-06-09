import { describe, expect, it } from "vitest";
import { RateLimiter, TokenBucket } from "../src/middleware/rate-limit.js";
import { createHarness } from "./support/harness.js";

describe("TokenBucket", () => {
  it("allows bursts up to capacity, then refills continuously", () => {
    const bucket = new TokenBucket(2, 1 / 1000, 0);
    expect(bucket.take(0)).toMatchObject({ allowed: true, remaining: 1 });
    expect(bucket.take(0)).toMatchObject({ allowed: true, remaining: 0 });
    const blocked = bucket.take(0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThanOrEqual(1000);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(1001);
    expect(bucket.take(500).allowed).toBe(false);
    expect(bucket.take(1000).allowed).toBe(true);
    expect(bucket.isFull(10_000)).toBe(true);
  });
});

describe("RateLimiter", () => {
  it("tracks keys independently", () => {
    let now = 0;
    const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 1, now: () => now });
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(false);
    expect(limiter.consume("b").allowed).toBe(true);
    now = 1000;
    expect(limiter.consume("a").allowed).toBe(true);
  });

  it("keeps memory bounded", () => {
    let now = 0;
    const limiter = new RateLimiter({ capacity: 5, refillPerSecond: 1, maxKeys: 10, now: () => now });
    for (let i = 0; i < 50; i++) limiter.consume(`ip-${i}`);
    expect(limiter.size).toBeLessThanOrEqual(10);
    now = 60_000;
    limiter.sweep();
    expect(limiter.size).toBe(0);
  });
});

describe("rate limit middleware", () => {
  it("returns 429 with Retry-After once the credential bucket is empty", async () => {
    const { api } = createHarness({ env: { AUTH_RATE_LIMIT_PER_MINUTE: "2" } });
    const attempt = () => api.post("/v1/auth/sign-in").send({ email: "guess@example.com", password: "password123" });
    const first = await attempt();
    expect(first.status).toBe(401);
    expect(first.headers["ratelimit-limit"]).toBe("2");
    expect((await attempt()).status).toBe(401);

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("rate_limited");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThanOrEqual(1);
    expect(blocked.headers["ratelimit-remaining"]).toBe("0");
  });
});
