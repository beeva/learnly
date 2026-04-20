import express from "express";
import { z } from "zod";
import { createClassroomSchema, joinClassroomSchema, type ClassroomId } from "@learnly/shared";
import { validationFailed } from "../../lib/errors.js";
import { asyncHandler, currentUser, parse, uuidParam } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middleware/authenticate.js";

export const classroomsRouter = express.Router();

const educatorOnly = [requireAuth, requireRole("educator")];

classroomsRouter.get(
  "/classrooms",
  requireAuth,
  asyncHandler(async (req, res) => {
    const classrooms = await req.container.resolve("classroomService").list(currentUser(req));
    res.json({ classrooms });
  }),
);

classroomsRouter.post(
  "/classrooms",
  ...educatorOnly,
  asyncHandler(async (req, res) => {
    const input = parse(createClassroomSchema, req.body);
    const classroom = await req.container.resolve("classroomService").create(currentUser(req), input);
    res.status(201).json({ classroom });
  }),
);

classroomsRouter.post(
  "/classrooms/join",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { joinCode } = parse(joinClassroomSchema, req.body);
    const classroom = await req.container.resolve("classroomService").join(currentUser(req), joinCode);
    res.json({ classroom });
  }),
);

classroomsRouter.get(
  "/classrooms/:id/members",
  ...educatorOnly,
  asyncHandler(async (req, res) => {
    const id = uuidParam(req, "id", "classroom") as ClassroomId;
    const members = await req.container.resolve("classroomService").members(currentUser(req), id);
    res.json({ members });
  }),
);

const MAX_WINDOW_DAYS = 90;

const windowSchema = z.object({
  from: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Use an ISO date").optional(),
  to: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Use an ISO date").optional(),
});

/** Defaults to the last 7 days. Accepts dates (2025-09-01) or full timestamps. */
function resolveWindow(query: unknown, now: Date): { from: string; to: string } {
  const { from, to } = parse(windowSchema, query, "query");
  const end = to ? new Date(to) : now;
  const start = from ? new Date(from) : new Date(end.getTime() - 7 * 86_400_000);
  if (start >= end) throw validationFailed("The start of the window must be before its end.");
  if (end.getTime() - start.getTime() > MAX_WINDOW_DAYS * 86_400_000) {
    throw validationFailed(`Insights cover at most ${MAX_WINDOW_DAYS} days at a time.`);
  }
  return { from: start.toISOString(), to: end.toISOString() };
}

classroomsRouter.get(
  "/classrooms/:id/insights",
  ...educatorOnly,
  asyncHandler(async (req, res) => {
    const id = uuidParam(req, "id", "classroom") as ClassroomId;
    const classroom = await req.container.resolve("classroomService").viewable(currentUser(req), id);
    const window = resolveWindow(req.query, req.container.resolve("clock").now());
    res.set("Cache-Control", "private, max-age=60");
    res.json(await req.container.resolve("insightsService").insights(classroom, window));
  }),
);

classroomsRouter.get(
  "/classrooms/:id/heatmap",
  ...educatorOnly,
  asyncHandler(async (req, res) => {
    const id = uuidParam(req, "id", "classroom") as ClassroomId;
    const classroom = await req.container.resolve("classroomService").viewable(currentUser(req), id);
    res.set("Cache-Control", "private, max-age=60");
    res.json(await req.container.resolve("insightsService").heatmap(classroom));
  }),
);

classroomsRouter.get(
  "/classrooms/:id/export.csv",
  ...educatorOnly,
  asyncHandler(async (req, res) => {
    const auth = currentUser(req);
    const id = uuidParam(req, "id", "classroom") as ClassroomId;
    const classroom = await req.container.resolve("classroomService").viewable(auth, id);
    const csv = await req.container.resolve("insightsService").exportCsv(classroom);
    // Exports contain student data: record who took one.
    await req.container.resolve("auditService").record({
      action: "classroom.export",
      actorId: auth.userId,
      targetType: "classroom",
      targetId: classroom.id,
    });
    const slug = classroom.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "classroom";
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="${slug}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.set("Cache-Control", "no-store");
    res.send(csv);
  }),
);
