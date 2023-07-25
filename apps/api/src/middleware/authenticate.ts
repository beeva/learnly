import type { RequestHandler } from "express";
import type { Role } from "@learnly/shared";
import { forbidden, unauthorized } from "../lib/errors.js";

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.trim().split(/\s+/);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

/**
 * Resolves `req.auth` from an `Authorization: Bearer <jwt>` header. With `optional`, a
 * missing or invalid token simply leaves the request anonymous.
 */
export function authenticate({ optional = false }: { optional?: boolean } = {}): RequestHandler {
  return (req, _res, next) => {
    const token = bearerToken(req.get("authorization"));
    if (!token) {
      next(optional ? undefined : unauthorized());
      return;
    }
    try {
      req.auth = req.container.resolve("tokens").verifyAccessToken(token);
      next();
    } catch (error) {
      next(optional ? undefined : error);
    }
  };
}

export const requireAuth = authenticate();
export const optionalAuth = authenticate({ optional: true });

