import express from "express";
import { z } from "zod";
import type { LessonId } from "@learnly/shared";
import { asyncHandler, currentUser, parse, stringParam, uuidParam } from "../../lib/http.js";
import { requireAuth } from "../../middleware/authenticate.js";

export const progressRouter = express.Router();

const lessonCompleteSchema = z.object({
  durationMs: z.number().int().min(0).max(4 * 60 * 60 * 1000),
});

progressRouter.get(
  "/progress",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    res.json(await req.container.resolve("progressService").overview(userId));
  }),
);

progressRouter.get(
  "/courses/:slug/mastery",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    const slug = stringParam(req, "slug", "course");
    const mastery = await req.container.resolve("progressService").courseMastery(userId, slug);
    res.json({ mastery });
  }),
);

progressRouter.get(
  "/recommendations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    const next = await req.container.resolve("progressService").recommendations(userId);
    res.json({ next });
  }),
);

progressRouter.post(
  "/lessons/:id/complete",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    const lessonId = uuidParam(req, "id", "lesson") as LessonId;
    const { durationMs } = parse(lessonCompleteSchema, req.body);
    res.json(await req.container.resolve("progressService").completeLesson(userId, lessonId, durationMs));
  }),
);
