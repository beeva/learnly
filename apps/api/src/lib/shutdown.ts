import type { Server } from "node:http";
import type { Container } from "../container.js";
import type { Logger } from "./logger.js";

export interface ShutdownOptions {
  server: Server;
  container: Container;
  logger: Logger;
  timeoutMs: number;
  exit?: (code: number) => void;
}

/**
 * On SIGTERM (ECS task stop, deploys) or SIGINT:
 *  1. fail readiness so the load balancer stops sending new requests,
 *  2. stop the nightly scheduler,
 *  3. stop accepting connections and let in-flight requests finish,
 *  4. close the database pool,
 * and force-exit if any of that takes longer than the timeout.
 */
export function installGracefulShutdown({ server, container, logger, timeoutMs, exit = process.exit }: ShutdownOptions) {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutting down");
    const timer = setTimeout(() => {
      logger.error({ timeoutMs }, "graceful shutdown timed out; forcing exit");
      server.closeAllConnections();
      exit(1);
    }, timeoutMs);
    timer.unref();

    try {
      if (container.has("lifecycle")) container.resolve("lifecycle").shuttingDown = true;
      if (container.isResolved("nightlyScheduler")) container.resolve("nightlyScheduler").stop();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        // Keep-alive sockets with no request in flight would otherwise hold close() open.
        server.closeIdleConnections();
      });
      if (container.isResolved("db")) await container.resolve("db").close();
      logger.info("shutdown complete");
      clearTimeout(timer);
      exit(0);
    } catch (error) {
      logger.error({ err: error }, "error during shutdown");
      exit(1);
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
  return shutdown;
}
