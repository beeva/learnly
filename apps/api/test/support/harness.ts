import { pino } from "pino";
import request from "supertest";
import { expect } from "vitest";
import type { Item, Response, User } from "@learnly/shared";
import { createApp, registerModules } from "../../src/app.js";
import { loadConfig } from "../../src/config/env.js";
import { createContainer } from "../../src/container.js";
import { fractions } from "../../src/db/seed/fractions.js";
import type { SeedCourse } from "../../src/db/seed/types.js";
import type { Clock } from "../../src/lib/clock.js";
import { correctResponseFor } from "../../src/lib/scoring.js";
import { installMemoryRepositories } from "./memory.js";

/** A clock tests can move: streaks, token expiry and review schedules depend on it. */
export class TestClock implements Clock {
  private current: number;

  constructor(start: string) {
    this.current = Date.parse(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current += ms;
  }

  advanceDays(days: number): void {
    this.advance(days * 86_400_000);
  }
}

export interface TestAccount {
  user: User;
  accessToken: string;
  refreshToken: string;
  auth: { Authorization: string };
}

export interface HarnessOptions {
  courses?: SeedCourse[];
  start?: string;
  env?: Record<string, string>;
}

let accounts = 0;

export function createHarness(options: HarnessOptions = {}) {
  const clock = new TestClock(options.start ?? "2024-03-04T16:00:00.000Z");
  const config = loadConfig({
    NODE_ENV: "test",
    JWT_SECRET: "test-only-secret-that-is-long-enough-0123",
    LOG_LEVEL: "silent",
    RATE_LIMIT_PER_MINUTE: "100000",
    AUTH_RATE_LIMIT_PER_MINUTE: "100000",
    ...options.env,
  });
  const container = registerModules(createContainer({ config, logger: pino({ level: "silent" }), clock }));
  container.register("transactions", () => ({ transaction: <T>(work: () => Promise<T>) => work() }));
  const store = installMemoryRepositories(container, clock, options.courses ?? [fractions]);
  const app = createApp(container);
  const api = request(app);

  async function signUp(overrides: Record<string, unknown> = {}): Promise<TestAccount> {
    accounts += 1;
    const res = await api.post("/v1/auth/sign-up").send({
      email: `learner${accounts}@example.com`,
      password: "fractions4ever",
      displayName: `Learner ${accounts}`,
      ...overrides,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const body = res.body as Omit<TestAccount, "auth">;
    return { ...body, auth: { Authorization: `Bearer ${body.accessToken}` } };
  }

  return { app, api, container, clock, store, config, signUp };
}

export type Harness = ReturnType<typeof createHarness>;

/** A response guaranteed to be wrong, of the right kind for the item. */
export function wrongResponseFor(item: Item): Response {
  switch (item.kind) {
    case "multiple_choice":
      return { kind: "multiple_choice", choiceId: item.choices.find((c) => c.id !== item.answer)?.id ?? "zz" };
    case "numeric":
      return { kind: "numeric", value: item.answer + 1000 };
    case "short_text":
      return { kind: "short_text", text: "definitely not it" };
    case "ordering":
      return { kind: "ordering", order: [...item.answer].reverse() };
  }
}

export { correctResponseFor };
