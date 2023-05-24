import { pino, type Logger } from "pino";

export type { Logger };

export interface LoggerOptions {
  level: string;
  pretty?: boolean;
}

/**
 * Structured JSON logs in production (shipped to CloudWatch), pretty output locally.
 * Anything that could identify a session or a password is redacted at the source.
 */
export function createLogger({ level, pretty = false }: LoggerOptions): Logger {
  return pino({
    level,
    base: { service: "learnly-api" },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
        "*.password",
        "*.passwordHash",
        "*.refreshToken",
        "*.accessToken",
      ],
      censor: "[redacted]",
    },
    ...(pretty
      ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss.l" } } }
      : {}),
  });
}
