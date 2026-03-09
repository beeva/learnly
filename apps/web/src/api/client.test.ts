import { HttpResponse, delay, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "../mocks/server";
import { ApiError, addRequestMiddleware, api, isApiError, request, secondsUntilExpiry, tokenStore } from "./client";

const OLD = { accessToken: "stale-access", refreshToken: "refresh-token-0000000000" };

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected the request to fail");
}

describe("request", () => {
  it("maps the error envelope onto ApiError, including field errors", async () => {
    server.use(
      http.get("*/v1/courses", () =>
        HttpResponse.json(
          { error: { code: "validation_failed", message: "Some fields need another look.", details: { fieldErrors: { email: ["Enter an email"], name: [] } } } },
          { status: 400 },
        ),
      ),
    );
    const error = await rejection(api.courses());
    expect(error.status).toBe(400);
    expect(error.code).toBe("validation_failed");
    expect(error.message).toBe("Some fields need another look.");
    expect(error.fieldErrors).toEqual({ email: "Enter an email" });
    expect(isApiError(error, "validation_failed")).toBe(true);
    expect(isApiError(error, "conflict")).toBe(false);
  });

  it("falls back to status-based codes for non-JSON errors", async () => {
    server.use(http.get("*/v1/courses/missing", () => new HttpResponse("nope", { status: 404 })));
    const error = await rejection(api.course("missing"));
    expect(error.code).toBe("not_found");
  });

  it("reports network failures with a friendly network error", async () => {
    server.use(http.get("*/v1/courses", () => HttpResponse.error()));
    const error = await rejection(api.courses());
    expect(error.code).toBe("network");
    expect(error.status).toBe(0);
  });

  it("returns undefined for 204 responses", async () => {
    server.use(http.post("*/v1/auth/sign-out", () => new HttpResponse(null, { status: 204 })));
    await expect(api.signOut(OLD.refreshToken)).resolves.toBeUndefined();
  });

  it("sends the bearer token when signed in", async () => {
    let seen: string | null = null;
    server.use(
      http.get("*/v1/me", ({ request: req }) => {
        seen = req.headers.get("Authorization");
        return HttpResponse.json({ user: null, preferences: null });
      }),
    );
    tokenStore.set(OLD);
    await api.me();
    expect(seen).toBe(`Bearer ${OLD.accessToken}`);
  });
});

describe("token refresh", () => {
  it("shares one refresh between concurrent 401s, then retries each request", async () => {
    let refreshes = 0;
    server.use(
      http.post("*/v1/auth/refresh", async () => {
        refreshes += 1;
        await delay(40);
        return HttpResponse.json({ accessToken: "fresh-access", refreshToken: "refresh-token-1111111111" });
      }),
      http.get("*/v1/courses", ({ request: req }) =>
        req.headers.get("Authorization") === "Bearer fresh-access"
          ? HttpResponse.json({ courses: [] })
          : HttpResponse.json({ error: { code: "unauthorized", message: "Expired" } }, { status: 401 }),
      ),
    );
    tokenStore.set(OLD);

    const results = await Promise.all([api.courses(), api.courses(), api.courses()]);
    expect(results).toEqual([{ courses: [] }, { courses: [] }, { courses: [] }]);
    expect(refreshes).toBe(1);
    expect(tokenStore.get()).toEqual({ accessToken: "fresh-access", refreshToken: "refresh-token-1111111111" });
  });

  it("drops the session when the refresh token is rejected", async () => {
    server.use(
      http.post("*/v1/auth/refresh", () => HttpResponse.json({ error: { code: "unauthorized", message: "Revoked" } }, { status: 401 })),
      http.get("*/v1/me", () => HttpResponse.json({ error: { code: "unauthorized", message: "Expired" } }, { status: 401 })),
    );
    tokenStore.set(OLD);
    const error = await rejection(api.me());
    expect(error.code).toBe("unauthorized");
    expect(tokenStore.has()).toBe(false);
  });

  it("keeps the session when the refresh endpoint has a server error", async () => {
    server.use(
      http.post("*/v1/auth/refresh", () => HttpResponse.json({ error: { code: "internal", message: "Boom" } }, { status: 503 })),
      http.get("*/v1/me", () => HttpResponse.json({ error: { code: "unauthorized", message: "Expired" } }, { status: 401 })),
    );
    tokenStore.set(OLD);
    await rejection(api.me());
    expect(tokenStore.get()).toEqual(OLD);
  });
});

describe("secondsUntilExpiry", () => {
  const jwt = (claims: object) => `header.${btoa(JSON.stringify(claims)).replace(/=+$/, "")}.sig`;

  it("reads exp from a JWT payload", () => {
    expect(secondsUntilExpiry(jwt({ exp: 1_000 }), 990_000)).toBe(10);
  });

  it("returns null for tokens it can't read", () => {
    expect(secondsUntilExpiry("opaque-token")).toBeNull();
    expect(secondsUntilExpiry(jwt({ sub: "x" }))).toBeNull();
  });
});

describe("middleware", () => {
  let remove: (() => void) | null = null;
  afterEach(() => remove?.());

  it("can answer a request without touching the network", async () => {
    server.use(http.get("*/v1/courses", () => HttpResponse.error()));
    remove = addRequestMiddleware((req, next) => (req.path === "/courses" ? Promise.resolve({ courses: ["from middleware"] }) : next(req)));
    await expect(request("/courses")).resolves.toEqual({ courses: ["from middleware"] });
  });

  it("passes requests it doesn't handle through to the network", async () => {
    server.use(http.get("*/v1/healthcheck-probe", () => HttpResponse.json({ ok: true })));
    remove = addRequestMiddleware((req, next) => next(req));
    await expect(request("/healthcheck-probe")).resolves.toEqual({ ok: true });
  });
});
