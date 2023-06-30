import { createHash, randomBytes } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Role, UserId } from "@learnly/shared";
import { unauthorized } from "./errors.js";
import type { AuthContext } from "./http.js";

const ROLES: readonly Role[] = ["student", "educator", "admin"];
const AUDIENCE = "learnly-apps";

export interface TokenServiceOptions {
  secret: string;
  issuer: string;
  accessTtlSeconds: number;
}

/**
 * Access tokens are short-lived HS256 JWTs carrying only the user id and role. They are
 * never stored; revocation happens by refusing to refresh them (see AuthService).
 */
export class TokenService {
  constructor(private readonly options: TokenServiceOptions) {}

  get accessTtlSeconds(): number {
    return this.options.accessTtlSeconds;
  }

  signAccessToken(userId: UserId, role: Role): string {
    return jwt.sign({ role }, this.options.secret, {
      algorithm: "HS256",
      subject: userId,
      issuer: this.options.issuer,
      audience: AUDIENCE,
      expiresIn: this.options.accessTtlSeconds,
    });
  }

  verifyAccessToken(token: string): AuthContext {
    let payload: string | JwtPayload;
    try {
      payload = jwt.verify(token, this.options.secret, {
        algorithms: ["HS256"],
        issuer: this.options.issuer,
        audience: AUDIENCE,
      });
    } catch {
      throw unauthorized("Your session has expired. Please sign in again.");
    }
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      throw unauthorized();
    }
    const role: unknown = payload["role"];
    if (!ROLES.includes(role as Role)) throw unauthorized();
    return { userId: payload.sub as UserId, role: role as Role };
  }
}

/** 256 bits of randomness, URL-safe so it survives being pasted into a header or deep link. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Refresh tokens are high-entropy, so a fast hash is enough — and lets us look them up by
 * hash without storing anything that could be replayed if the table leaked.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
