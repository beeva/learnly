import type { FeatureModule } from "../../container.js";
import { PgEventRepository, type EventRepository } from "./repository.js";
import { eventsRouter } from "./routes.js";
import { EventsService } from "./service.js";

declare module "../../container.js" {
  interface Services {
    eventRepository: EventRepository;
    eventsService: EventsService;
  }
}

export const eventsModule: FeatureModule = {
  name: "events",
  router: eventsRouter,
  register(container) {
    container
      .register("eventRepository", (c) => new PgEventRepository(c.resolve("db")))
      .register(
        "eventsService",
        (c) => new EventsService(c.resolve("eventRepository"), c.resolve("clock"), c.resolve("metrics")),
      );
  },
};
