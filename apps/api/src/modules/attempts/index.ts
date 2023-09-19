import type { FeatureModule } from "../../container.js";
import {
  PgAttemptRepository,
  PgMasteryRepository,
  type AttemptRepository,
  type MasteryRepository,
} from "./repository.js";
import { attemptsRouter } from "./routes.js";
import { AttemptService, RaschMasteryModel, type AttemptSubmitter, type MasteryModel } from "./service.js";

declare module "../../container.js" {
  interface Services {
    attemptRepository: AttemptRepository;
    masteryRepository: MasteryRepository;
    masteryModel: MasteryModel;
    attemptSubmitter: AttemptSubmitter;
  }
}

export const attemptsModule: FeatureModule = {
  name: "attempts",
  router: attemptsRouter,
  register(container) {
    container
      .register("attemptRepository", (c) => new PgAttemptRepository(c.resolve("db")))
      .register("masteryRepository", (c) => new PgMasteryRepository(c.resolve("db")))
      .register("masteryModel", (c) => new RaschMasteryModel(c.resolve("masteryRepository")))
      .register(
        "attemptSubmitter",
        (c) =>
          new AttemptService({
            catalog: c.resolve("catalogRepository"),
            attempts: c.resolve("attemptRepository"),
            mastery: c.resolve("masteryModel"),
            transactions: c.resolve("transactions"),
            clock: c.resolve("clock"),
          }),
      );
  },
};
