import type { FeatureModule } from "../../container.js";
import { PgCatalogChangeFeed, type CatalogChangeFeed } from "../catalog/repository.js";
import { PgSyncRepository, type SyncRepository } from "./repository.js";
import { syncRouter } from "./routes.js";
import { SyncService } from "./service.js";

declare module "../../container.js" {
  interface Services {
    syncRepository: SyncRepository;
    catalogChangeFeed: CatalogChangeFeed;
    syncService: SyncService;
  }
}

export const syncModule: FeatureModule = {
  name: "sync",
  router: syncRouter,
  register(container) {
    container
      .register("syncRepository", (c) => new PgSyncRepository(c.resolve("db")))
      .register("catalogChangeFeed", (c) => new PgCatalogChangeFeed(c.resolve("db")))
      .register(
        "syncService",
        (c) =>
          new SyncService({
            sync: c.resolve("syncRepository"),
            changes: c.resolve("catalogChangeFeed"),
            attempts: c.resolve("attemptSubmitter"),
            progress: c.resolve("progressService"),
            profile: c.resolve("profileService"),
            transactions: c.resolve("transactions"),
            clock: c.resolve("clock"),
            logger: c.resolve("logger"),
          }),
      );
  },
};
