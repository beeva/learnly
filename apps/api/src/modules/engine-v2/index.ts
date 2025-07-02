import type { FeatureModule } from "../../container.js";
import { RaschMasteryModel } from "../attempts/service.js";
import {
  PgBktParamsRepository,
  PgReviewStateRepository,
  type BktParamsRepository,
  type ReviewStateRepository,
} from "./repository.js";
import { BktMasteryModel, BktParamsCache, DueReviewPlanner } from "./service.js";

declare module "../../container.js" {
  interface Services {
    reviewStateRepository: ReviewStateRepository;
    bktParamsRepository: BktParamsRepository;
    bktParams: BktParamsCache;
  }
}

export const engineV2Module: FeatureModule = {
  name: "engine-v2",
  register(container) {
    container
      .register("reviewStateRepository", (c) => new PgReviewStateRepository(c.resolve("db")))
      .register("bktParamsRepository", (c) => new PgBktParamsRepository(c.resolve("db")))
      .register("bktParams", (c) => new BktParamsCache(c.resolve("bktParamsRepository"), c.resolve("clock")))
      // v1 stays one env var away, for rollback and for A/B comparisons.
      .register("masteryModel", (c) =>
        c.resolve("features").ENGINE_VERSION === "v2"
          ? new BktMasteryModel(c.resolve("masteryRepository"), c.resolve("reviewStateRepository"), c.resolve("bktParams"))
          : new RaschMasteryModel(c.resolve("masteryRepository")),
      );
  },
};

