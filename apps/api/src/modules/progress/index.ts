import type { FeatureModule } from "../../container.js";
import { PgProgressRepository, type ProgressRepository } from "./repository.js";
import { progressRouter } from "./routes.js";
import { ProgressService, RewardingAttemptSubmitter } from "./service.js";

declare module "../../container.js" {
  interface Services {
    progressRepository: ProgressRepository;
    progressService: ProgressService;
  }
}

export const progressModule: FeatureModule = {
  name: "progress",
  router: progressRouter,
  register(container) {
    container
      .register("progressRepository", (c) => new PgProgressRepository(c.resolve("db")))
      .register(
        "progressService",
        (c) =>
          new ProgressService({
            progress: c.resolve("progressRepository"),
            users: c.resolve("userRepository"),
            catalog: c.resolve("catalogRepository"),
            mastery: c.resolve("masteryRepository"),
            sessions: c.resolve("sessionRepository"),
            transactions: c.resolve("transactions"),
            clock: c.resolve("clock"),
          }),
      )
      // Every scored attempt now earns XP, moves the streak and gets an encouragement key.
      .decorate(
        "attemptSubmitter",
        (inner, c) =>
          new RewardingAttemptSubmitter(
            inner,
            c.resolve("progressService"),
            c.resolve("progressRepository"),
            c.resolve("transactions"),
          ),
      )
      // `/me` gains the learner's progress summary.
      .decorate("profileService", (inner, c) => ({
        async get(userId) {
          const me = await inner.get(userId);
          const progress = await c.resolve("progressService").summary(userId, me.preferences.dailyGoalMinutes);
          const withProgress = { ...me, progress };
          return withProgress;
        },
        updatePreferences: (userId, patch) => inner.updatePreferences(userId, patch),
      }));
  },
};
