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

