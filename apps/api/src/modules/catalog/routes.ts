import express from "express";
import type { LessonId, SkillId } from "@learnly/shared";
import { asyncHandler, stringParam, uuidParam } from "../../lib/http.js";

/**
 * The catalog is public: it is the same for everyone, contains no answer keys, and can be
 * cached by the CDN in front of the API.
 */
export const catalogRouter = express.Router();

catalogRouter.get(
  "/courses",
  asyncHandler(async (req, res) => {
    const courses = await req.container.resolve("catalogService").listCourses();
    res.json({ courses });
  }),
);

catalogRouter.get(
  "/courses/:slug",
  asyncHandler(async (req, res) => {
    const slug = stringParam(req, "slug", "course");
    res.json(await req.container.resolve("catalogService").getCourse(slug));
  }),
);

catalogRouter.get(
  "/lessons/:id",
  asyncHandler(async (req, res) => {
    const id = uuidParam(req, "id", "lesson") as LessonId;
    res.json(await req.container.resolve("catalogService").getLesson(id));
  }),
);

catalogRouter.get(
  "/skills/:id/lessons",
  asyncHandler(async (req, res) => {
    const id = uuidParam(req, "id", "skill") as SkillId;
    const lessons = await req.container.resolve("catalogService").lessonsForSkill(id);
    res.json({ lessons });
  }),
);
