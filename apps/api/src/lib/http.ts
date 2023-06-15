import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";
import { isUuid, type Role, type UserId } from "@learnly/shared";
import type { Container } from "../container.js";
import { notFound, unauthorized, validationFailed } from "./errors.js";

export interface AuthContext {
  userId: UserId;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlates log lines, audit entries and error reports for one request. */
      requestId: string;
      /** The service container of the app handling this request. */
      container: Container;
      /** Present once `authenticate()` has verified a bearer token. */
      auth?: AuthContext;
    }
  }
}

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Express 4 doesn't forward rejected promises; this does, so handlers can just throw. */
export function asyncHandler(route: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    route(req, res, next).catch(next);
  };
}

/** Validate untrusted input against a shared zod schema and return the parsed value. */
export function parse<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
  source: "body" | "query" = "body",
): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw validationFailed(
      source === "body" ? "Some fields need another look." : "Some filters in the address aren't valid.",
      result.error.flatten(),
    );
  }
  return result.data;
}

/** Route params that are ids must be UUIDs; anything else can't exist, so it's a 404. */
export function uuidParam(req: Request, name: string, what = "page"): string {
  const value = req.params[name];
  if (!isUuid(value)) throw notFound(what);
  return value;
}

export function stringParam(req: Request, name: string, what = "page"): string {
  const value = req.params[name];
  if (value === undefined || value.length === 0 || value.length > 120) throw notFound(what);
  return value;
}

export function currentUser(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

export function userAgentOf(req: Request): string | null {
  const agent = req.get("user-agent");
  return agent ? agent.slice(0, 256) : null;
}
