import express from "express";
import { asyncHandler, parse } from "../../lib/http.js";
import { optionalAuth } from "../../middleware/authenticate.js";
import { eventBatchSchema } from "./service.js";

export const eventsRouter = express.Router();

/**
 * Fire-and-forget product analytics. Signed-out screens (onboarding, sign-in) can send
 * events too; they are stored without a user id.
 */
eventsRouter.post(
  "/events",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const batch = parse(eventBatchSchema, req.body);
    const result = await req.container.resolve("eventsService").ingest(req.auth?.userId ?? null, batch);
    res.status(202).json(result);
  }),
);
