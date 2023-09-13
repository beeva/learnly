import express from "express";
import { attemptInputSchema } from "@learnly/shared";
import { asyncHandler, currentUser, parse } from "../../lib/http.js";
import { requireAuth } from "../../middleware/authenticate.js";

export const attemptsRouter = express.Router();

/**
 * Idempotent on `clientAttemptId`: a retried request returns the original result (same
 * attempt id, no double XP) instead of recording the answer twice.
 */
attemptsRouter.post(
  "/attempts",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    const input = parse(attemptInputSchema, req.body);
    const outcome = await req.container.resolve("attemptSubmitter").submit(userId, input);
    res.json(outcome.body);
  }),
);
