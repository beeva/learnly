import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, internal, notFound, validationFailed } from "../lib/errors.js";

interface BodyParserError {
  type?: string;
  status?: number;
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) return validationFailed("Some fields need another look.", error.flatten());
  const parserError = error as BodyParserError;
  if (parserError?.type === "entity.parse.failed") {
    return validationFailed("The request body isn't valid JSON.");
  }
  if (parserError?.type === "entity.too.large") {
    return new AppError("validation_failed", "That request is too large.", undefined, 413);
  }
  return internal();
}

/** Unmatched routes get the same error envelope as everything else. */
export function notFoundHandler(): RequestHandler {
  return (req, _res, next) => {
    next(notFound(`route ${req.method} ${req.path}`));
  };
}

/**
 * The single place errors become responses. Expected errors (validation, auth, 404s) are
 * logged quietly; anything else is logged with its stack and hidden behind a generic
 * message so internals never leak to clients.
 */
export function errorHandler(): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    const appError = toAppError(error);
    if (appError.status >= 500) {
      req.log.error({ err: error, requestId: req.requestId }, "request failed");
    } else {
      req.log.debug({ code: appError.code, message: appError.message }, "request rejected");
    }
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(appError.status).json(appError.toBody());
  };
}
