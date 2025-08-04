import type { FeatureModule } from "../../container.js";
import { PgAuditRepository, type AuditRepository } from "./repository.js";
import { AuditedAuthService, AuditService, requestContextMiddleware } from "./service.js";

declare module "../../container.js" {
  interface Services {
    auditRepository: AuditRepository;
    auditService: AuditService;
  }
}

export const auditModule: FeatureModule = {
  name: "audit",
  middleware: () => [requestContextMiddleware()],
  register(container) {
    container
      .register("auditRepository", (c) => new PgAuditRepository(c.resolve("db")))
      .register(
        "auditService",
        (c) => new AuditService(c.resolve("auditRepository"), c.resolve("logger"), c.resolve("clock")),
      )
      .decorate("authService", (inner, c) => new AuditedAuthService(inner, c.resolve("auditService")));
  },
};
