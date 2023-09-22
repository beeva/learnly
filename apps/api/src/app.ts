import { randomUUID } from "node:crypto";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Container, FeatureModule } from "./container.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { RateLimiter, rateLimit } from "./middleware/rate-limit.js";
import { requestId } from "./middleware/request-id.js";
import { attemptsModule } from "./modules/attempts/index.js";
import { authModule } from "./modules/auth/index.js";
import { catalogModule } from "./modules/catalog/index.js";
import { usersModule } from "./modules/users/index.js";

/**
 * Feature modules in registration order. Order matters for `decorate()`: a module can
 * only wrap services registered by modules before it.
 */
export const featureModules: FeatureModule[] = [usersModule, authModule, catalogModule, attemptsModule];

export function registerModules(container: Container, modules: FeatureModule[] = featureModules): Container {
  for (const feature of modules) feature.register?.(container);
  return container;
}

/**
 * Build the HTTP app around an already-populated container. No I/O happens here, so tests
 * can build as many apps as they like against in-memory repositories.
 */
export function createApp(container: Container, modules: FeatureModule[] = featureModules): Express {
  const config = container.resolve("config");
  const logger = container.resolve("logger");
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", config.TRUST_PROXY);

  app.use(requestId());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as unknown as { requestId?: string }).requestId ?? randomUUID(),
      autoLogging: { ignore: (req) => req.url === "/healthz" || req.url === "/metrics" },
      customLogLevel: (_req, res, error) =>
        error || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGINS,
      credentials: false,
      maxAge: 600,
      exposedHeaders: ["x-request-id", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset", "Retry-After"],
    }),
  );
  // Generous enough for an offline batch of answers; anything bigger is a mistake or abuse.
  app.use(express.json({ limit: "512kb" }));
  app.use((req, _res, next) => {
    req.container = container;
    next();
  });

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  for (const feature of modules) {
    for (const middleware of feature.middleware?.(container) ?? []) app.use(middleware);
  }

  const apiLimiter = RateLimiter.perMinute(config.RATE_LIMIT_PER_MINUTE);
  const v1 = express.Router();
  v1.use(rateLimit(() => apiLimiter));
  for (const feature of modules) {
    if (feature.router) v1.use(feature.router);
    if (feature.rootRouter) app.use(feature.rootRouter);
  }
  app.use("/v1", v1);

  app.use(notFoundHandler());
  app.use(errorHandler());
  return app;
}

