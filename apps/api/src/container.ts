import type { RequestHandler, Router } from "express";
import type { AppConfig } from "./config/env.js";
import { Database, type TransactionRunner } from "./db/sql.js";
import { systemClock, type Clock } from "./lib/clock.js";
import type { Logger } from "./lib/logger.js";

/**
 * Every service the API can resolve, by name. Feature modules add their own entries
 * through module augmentation:
 *
 *   declare module "../../container.js" {
 *     interface Services { catalogService: CatalogService }
 *   }
 *
 * so `container.resolve("catalogService")` is fully typed without a central file that
 * has to import every feature.
 */
export interface Services {
  config: AppConfig;
  logger: Logger;
  clock: Clock;
  db: Database;
  transactions: TransactionRunner;
}

export type ServiceKey = keyof Services;
type Factory<K extends ServiceKey> = (container: Container) => Services[K];

/**
 * A deliberately small dependency container: lazy singletons, explicit registration,
 * and `decorate()` so a later feature can wrap an existing service (e.g. award XP after
 * an attempt is scored) without the original module knowing about it.
 */
export class Container {
  private readonly factories = new Map<ServiceKey, (container: Container) => unknown>();
  private readonly instances = new Map<ServiceKey, unknown>();
  private readonly resolving = new Set<ServiceKey>();

  register<K extends ServiceKey>(key: K, factory: Factory<K>): this {
    this.factories.set(key, factory);
    this.instances.delete(key);
    return this;
  }

  decorate<K extends ServiceKey>(key: K, wrap: (inner: Services[K], container: Container) => Services[K]): this {
    const previous = this.factories.get(key);
    if (!previous) throw new Error(`Cannot decorate "${key}" before it is registered`);
    return this.register(key, (container) => wrap(previous(container) as Services[K], container));
  }

  resolve<K extends ServiceKey>(key: K): Services[K] {
    if (this.instances.has(key)) return this.instances.get(key) as Services[K];
    const factory = this.factories.get(key);
    if (!factory) throw new Error(`No service registered for "${key}"`);
    if (this.resolving.has(key)) throw new Error(`Circular dependency while resolving "${key}"`);
    this.resolving.add(key);
    try {
      const instance = factory(this) as Services[K];
      this.instances.set(key, instance);
      return instance;
    } finally {
      this.resolving.delete(key);
    }
  }

  has(key: ServiceKey): boolean {
    return this.factories.has(key);
  }

  /** Whether a service has actually been created — shutdown only closes what was opened. */
  isResolved(key: ServiceKey): boolean {
    return this.instances.has(key);
  }
}

/** A vertical slice of the API: its services, its routes and any global middleware. */
export interface FeatureModule {
  name: string;
  /** Register (or decorate) services. Runs once per container, in module order. */
  register?(container: Container): void;
  /** Middleware installed ahead of every router, e.g. compression or metrics. */
  middleware?(container: Container): RequestHandler[];
  /** Routes mounted under `/v1`. */
  router?: Router;
  /** Routes mounted at the root, e.g. health checks. */
  rootRouter?: Router;
}

export interface ContainerOptions {
  config: AppConfig;
  logger: Logger;
  clock?: Clock;
}

export function createContainer({ config, logger, clock = systemClock }: ContainerOptions): Container {
  return new Container()
    .register("config", () => config)
    .register("logger", () => logger)
    .register("clock", () => clock)
    .register(
      "db",
      (c) =>
        new Database({
          connectionString: config.DATABASE_URL,
          max: config.DATABASE_POOL_MAX,
          logger: c.resolve("logger"),
        }),
    )
    .register("transactions", (c) => c.resolve("db"));
}
