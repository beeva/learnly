import type { FeatureModule } from "../../container.js";
import { PgCatalogRepository, type CatalogRepository } from "./repository.js";
import { catalogRouter } from "./routes.js";
import { CatalogService } from "./service.js";

declare module "../../container.js" {
  interface Services {
    catalogRepository: CatalogRepository;
    catalogService: CatalogService;
  }
}

export const catalogModule: FeatureModule = {
  name: "catalog",
  router: catalogRouter,
  register(container) {
    container
      .register("catalogRepository", (c) => new PgCatalogRepository(c.resolve("db")))
      .register("catalogService", (c) => new CatalogService(c.resolve("catalogRepository")));
  },
};
