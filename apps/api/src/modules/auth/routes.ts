import express from "express";
import { refreshSchema, signInSchema, signUpSchema } from "@learnly/shared";
import { asyncHandler, parse, userAgentOf } from "../../lib/http.js";
import { rateLimit } from "../../middleware/rate-limit.js";

export const authRouter = express.Router();

/** Credential endpoints get their own, much stricter bucket than the rest of the API. */
const credentialLimit = rateLimit((req) => req.container.resolve("authRateLimiter"));

authRouter.post(
  "/auth/sign-up",
  credentialLimit,
  asyncHandler(async (req, res) => {
    const input = parse(signUpSchema, req.body);
    const session = await req.container.resolve("authService").signUp(input, { userAgent: userAgentOf(req) });
    res.status(201).json(session);
  }),
);

authRouter.post(
  "/auth/sign-in",
  credentialLimit,
  asyncHandler(async (req, res) => {
    const input = parse(signInSchema, req.body);
    const session = await req.container.resolve("authService").signIn(input, { userAgent: userAgentOf(req) });
    res.json(session);
  }),
);

authRouter.post(
  "/auth/refresh",
  credentialLimit,
  asyncHandler(async (req, res) => {
    const { refreshToken } = parse(refreshSchema, req.body);
    const pair = await req.container.resolve("authService").refresh(refreshToken, { userAgent: userAgentOf(req) });
    res.json(pair);
  }),
);

authRouter.post(
  "/auth/sign-out",
  asyncHandler(async (req, res) => {
    const { refreshToken } = parse(refreshSchema, req.body);
    await req.container.resolve("authService").signOut(refreshToken);
    res.status(204).end();
  }),
);
