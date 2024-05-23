import type { FeatureModule } from "../../container.js";
import { PgSessionRepository, type SessionRepository } from "./repository.js";
import { sessionsRouter } from "./routes.js";
import { LeastRecentReviewPlanner, SessionAwareSubmitter, SessionService, type ReviewPlanner } from "./service.js";

declare module "../../container.js" {
  interface Services {
    sessionRepository: SessionRepository;
    reviewPlanner: ReviewPlanner;
    sessionService: SessionService;
  }
}

export const sessionsModule: FeatureModule = {
  name: "sessions",
  router: sessionsRouter,
  register(container) {
    container
      .register("sessionRepository", (c) => new PgSessionRepository(c.resolve("db")))
      .register("reviewPlanner", () => new LeastRecentReviewPlanner())
      .register(
        "sessionService",
        (c) =>
          new SessionService({
            sessions: c.resolve("sessionRepository"),
            catalog: c.resolve("catalogRepository"),
            mastery: c.resolve("masteryRepository"),
            progress: c.resolve("progressService"),
            reviewPlanner: c.resolve("reviewPlanner"),
            clock: c.resolve("clock"),
          }),
      )
      .decorate(
        "attemptSubmitter",
        (inner, c) =>
          new SessionAwareSubmitter(
            inner,
            c.resolve("sessionRepository"),
            c.resolve("attemptRepository"),
            c.resolve("transactions"),
          ),
      );
  },
};
