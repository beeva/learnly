import express from "express";
import { startSessionSchema, type SessionId } from "@learnly/shared";
import { asyncHandler, currentUser, parse, uuidParam } from "../../lib/http.js";
import { requireAuth } from "../../middleware/authenticate.js";

export const sessionsRouter = express.Router();

sessionsRouter.post(
  "/sessions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    const input = parse(startSessionSchema, req.body);
    res.status(201).json(await req.container.resolve("sessionService").start(userId, input));
  }),
);

sessionsRouter.get(
  "/sessions/:id/next",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    const id = uuidParam(req, "id", "session") as SessionId;
    res.json(await req.container.resolve("sessionService").next(userId, id));
  }),
);

sessionsRouter.post(
  "/sessions/:id/complete",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    const id = uuidParam(req, "id", "session") as SessionId;
    res.json(await req.container.resolve("sessionService").complete(userId, id));
  }),
);
