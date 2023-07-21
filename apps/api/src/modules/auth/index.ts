import type { FeatureModule } from "../../container.js";
import { argon2Hasher, type PasswordHasher } from "../../lib/passwords.js";
import { TokenService } from "../../lib/tokens.js";
import { RateLimiter } from "../../middleware/rate-limit.js";
import { PgRefreshTokenRepository, type RefreshTokenRepository } from "./repository.js";
import { authRouter } from "./routes.js";
import { AuthService, type AuthApi } from "./service.js";

declare module "../../container.js" {
  interface Services {
    passwordHasher: PasswordHasher;
    tokens: TokenService;
    refreshTokenRepository: RefreshTokenRepository;
    authRateLimiter: RateLimiter;
    authService: AuthApi;
  }
}

export const authModule: FeatureModule = {
  name: "auth",
  router: authRouter,
  register(container) {
    container
      .register("passwordHasher", () => argon2Hasher)
      .register("tokens", (c) => {
        const config = c.resolve("config");
        return new TokenService({
          secret: config.JWT_SECRET,
          issuer: config.JWT_ISSUER,
          accessTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
        });
      })
      .register("refreshTokenRepository", (c) => new PgRefreshTokenRepository(c.resolve("db")))
      .register("authRateLimiter", (c) => RateLimiter.perMinute(c.resolve("config").AUTH_RATE_LIMIT_PER_MINUTE))
      .register(
        "authService",
        (c) =>
          new AuthService({
            users: c.resolve("userRepository"),
            refreshTokens: c.resolve("refreshTokenRepository"),
            hasher: c.resolve("passwordHasher"),
            tokens: c.resolve("tokens"),
            transactions: c.resolve("transactions"),
            clock: c.resolve("clock"),
            logger: c.resolve("logger"),
            refreshTtlDays: c.resolve("config").REFRESH_TOKEN_TTL_DAYS,
          }),
      );
  },
};
