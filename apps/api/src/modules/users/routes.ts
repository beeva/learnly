import express from "express";
import * as shared from "@learnly/shared";
import { requireAuth } from "../../middleware/authenticate.js";
import { asyncHandler, currentUser, parse } from "../../lib/http.js";

export const usersRouter = express.Router();

usersRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    res.json(await req.container.resolve("profileService").get(userId));
  }),
);

