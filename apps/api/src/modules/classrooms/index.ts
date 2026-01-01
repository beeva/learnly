import type { FeatureModule } from "../../container.js";
import { PgInsightsRepository, type InsightsRepository } from "../insights/repository.js";
import { InsightsService } from "../insights/service.js";
import { PgClassroomRepository, type ClassroomRepository } from "./repository.js";
import { classroomsRouter } from "./routes.js";
import { ClassroomService } from "./service.js";

declare module "../../container.js" {
  interface Services {
    classroomRepository: ClassroomRepository;
    classroomService: ClassroomService;
    insightsRepository: InsightsRepository;
    insightsService: InsightsService;
  }
}

export const classroomsModule: FeatureModule = {
  name: "classrooms",
  router: classroomsRouter,
  register(container) {
    container
      .register("classroomRepository", (c) => new PgClassroomRepository(c.resolve("db")))
      .register("insightsRepository", (c) => new PgInsightsRepository(c.resolve("db")))
      .register(
        "classroomService",
        (c) =>
          new ClassroomService({
            classrooms: c.resolve("classroomRepository"),
            catalog: c.resolve("catalogRepository"),
            audit: c.resolve("auditService"),
          }),
      )
      .register(
        "insightsService",
        (c) =>
          new InsightsService({
            insights: c.resolve("insightsRepository"),
            catalog: c.resolve("catalogRepository"),
            classrooms: c.resolve("classroomRepository"),
            clock: c.resolve("clock"),
          }),
      );
  },
};
