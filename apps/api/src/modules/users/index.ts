import type { FeatureModule } from "../../container.js";
import { PgUserRepository, type UserRepository } from "./repository.js";
import { usersRouter } from "./routes.js";
import { ProfileService, type ProfileApi } from "./service.js";

declare module "../../container.js" {
  interface Services {
    userRepository: UserRepository;
    profileService: ProfileApi;
  }
}

export const usersModule: FeatureModule = {
  name: "users",
  router: usersRouter,
  register(container) {
    container
      .register("userRepository", (c) => new PgUserRepository(c.resolve("db")))
      .register("profileService", (c) => new ProfileService(c.resolve("userRepository")));
  },
};
