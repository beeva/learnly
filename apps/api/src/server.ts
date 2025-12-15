import { createApp, registerModules } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createContainer } from "./container.js";
import { createLogger } from "./lib/logger.js";

const config = loadConfig();
const logger = createLogger({ level: config.LOG_LEVEL, pretty: config.NODE_ENV === "development" });
const container = registerModules(createContainer({ config, logger }));
const app = createApp(container);

const server = app.listen(config.PORT, config.HOST, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, "learnly api listening");
});

// Outlive the load balancer's idle timeout so it never reuses a socket we just closed.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandled promise rejection");
});

import { installGracefulShutdown } from "./lib/shutdown.js";

const features = container.resolve("features");
if (features.JOBS_ENABLED) container.resolve("nightlyScheduler").start();

installGracefulShutdown({
  server,
  container,
  logger,
  timeoutMs: features.SHUTDOWN_TIMEOUT_MS,
});
