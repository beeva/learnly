import express from "express";
import { syncPushSchema } from "@learnly/shared";
import { asyncHandler, currentUser, parse } from "../../lib/http.js";
import { requireAuth } from "../../middleware/authenticate.js";

export const syncRouter = express.Router();

/**
 * Push the offline outbox and pull deltas in one round trip. Always 200 when the batch
 * was processed — per-operation outcomes (applied / duplicate / rejected) are in `results`.
 */
syncRouter.post(
  "/sync",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    const input = parse(syncPushSchema, req.body);
    res.set("Cache-Control", "no-store");
    res.json(await req.container.resolve("syncService").push(userId, input));
  }),
);
