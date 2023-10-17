import { describe, expect, it } from "vitest";
import { createHarness } from "./support/harness.js";

describe("auth", () => {
  it("signs up a learner and returns tokens", async () => {
    const { api } = createHarness();
    const res = await api.post("/v1/auth/sign-up").send({
      email: "Ada@Example.com",
      password: "fractions4ever",
      displayName: "Ada",
      gradeBand: "3-5",
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: "ada@example.com", displayName: "Ada", role: "student", gradeBand: "3-5" });
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken.length).toBeGreaterThanOrEqual(40);
  });

  it("rejects a duplicate email with a friendly conflict", async () => {
    const { api, signUp } = createHarness();
    await signUp({ email: "maya@example.com" });
    const res = await api
      .post("/v1/auth/sign-up")
      .send({ email: "MAYA@example.com", password: "another1pass", displayName: "Maya" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("conflict");
  });

  it("returns validation details in the standard envelope", async () => {
    const { api } = createHarness();
    const res = await api.post("/v1/auth/sign-up").send({ email: "not-an-email", password: "short", displayName: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "validation_failed", message: expect.any(String) });
    expect(Object.keys(res.body.error.details.fieldErrors)).toEqual(
      expect.arrayContaining(["email", "password", "displayName"]),
    );
  });

  it("signs in with the right password only, without revealing which part was wrong", async () => {
    const { api, signUp } = createHarness();
    await signUp({ email: "leo@example.com", password: "numberline42" });
    const ok = await api.post("/v1/auth/sign-in").send({ email: "leo@example.com", password: "numberline42" });
    expect(ok.status).toBe(200);
    const wrongPassword = await api.post("/v1/auth/sign-in").send({ email: "leo@example.com", password: "numberline43" });
    const unknownEmail = await api.post("/v1/auth/sign-in").send({ email: "nobody@example.com", password: "numberline42" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it("serves /me for a valid token and 401s otherwise", async () => {
    const { api, signUp } = createHarness();
    const account = await signUp({ displayName: "Priya" });
    const me = await api.get("/v1/me").set(account.auth);
    expect(me.status).toBe(200);
    expect(me.body.user.displayName).toBe("Priya");
    expect(me.body.preferences).toEqual({ dailyGoalMinutes: 15, reducedMotion: false, soundEffects: true, locale: "en" });

    expect((await api.get("/v1/me")).status).toBe(401);
    const tampered = await api.get("/v1/me").set({ Authorization: `Bearer ${account.accessToken}x` });
    expect(tampered.status).toBe(401);
    expect(tampered.body.error.code).toBe("unauthorized");
  });

  it("answers unknown routes with the error envelope", async () => {
    const { api } = createHarness();
    const res = await api.get("/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });
});

describe("refresh tokens", () => {
  it("rotates on every refresh", async () => {
    const { api, signUp } = createHarness();
    const account = await signUp();
    const first = await api.post("/v1/auth/refresh").send({ refreshToken: account.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(account.refreshToken);
    const second = await api.post("/v1/auth/refresh").send({ refreshToken: first.body.refreshToken });
    expect(second.status).toBe(200);
  });

  it("revokes the whole family when a rotated token is reused", async () => {
    const { api, signUp, store } = createHarness();
    const account = await signUp();
    const rotated = await api.post("/v1/auth/refresh").send({ refreshToken: account.refreshToken });
    expect(rotated.status).toBe(200);

    // An attacker replays the original (already used) token…
    const replay = await api.post("/v1/auth/refresh").send({ refreshToken: account.refreshToken });
    expect(replay.status).toBe(401);
    // …so the legitimate, newer token stops working too.
    const victim = await api.post("/v1/auth/refresh").send({ refreshToken: rotated.body.refreshToken });
    expect(victim.status).toBe(401);
    expect([...store.refreshTokens.rows.values()].every((token) => token.revokedAt !== null)).toBe(true);
  });

  it("refuses expired refresh tokens", async () => {
    const { api, signUp, clock, config } = createHarness();
    const account = await signUp();
    clock.advanceDays(config.REFRESH_TOKEN_TTL_DAYS + 1);
    const res = await api.post("/v1/auth/refresh").send({ refreshToken: account.refreshToken });
    expect(res.status).toBe(401);
  });

  it("signs out by revoking the session's token family", async () => {
    const { api, signUp } = createHarness();
    const account = await signUp();
    const out = await api.post("/v1/auth/sign-out").send({ refreshToken: account.refreshToken });
    expect(out.status).toBe(204);
    const refresh = await api.post("/v1/auth/refresh").send({ refreshToken: account.refreshToken });
    expect(refresh.status).toBe(401);
    // Signing out twice is harmless.
    expect((await api.post("/v1/auth/sign-out").send({ refreshToken: account.refreshToken })).status).toBe(204);
  });
});
