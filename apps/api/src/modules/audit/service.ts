import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import type { SignInInput, SignUpInput, UserId } from "@learnly/shared";
import type { Clock } from "../../lib/clock.js";
import { AppError } from "../../lib/errors.js";
import type { Logger } from "../../lib/logger.js";
import { TokenReuseError, type AuthApi, type ClientMeta } from "../auth/service.js";
import type { AuditRepository } from "./repository.js";

export interface RequestContext {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
}

/** Who/where for the current request, available to services without threading `req`. */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function requestContextMiddleware(): RequestHandler {
  return (req, _res, next) => {
    requestContext.run(
      { requestId: req.requestId, ip: req.ip ?? null, userAgent: req.get("user-agent")?.slice(0, 256) ?? null },
      next,
    );
  };
}

export interface AuditEntry {
  action: string;
  actorId: UserId | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/** Never store raw emails of failed sign-ins: a hash still lets us spot credential stuffing. */
export function emailFingerprint(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
}

/**
 * Writes each entry to the `audit_log` table and as a structured log line (`audit: {…}`),
 * so it is queryable in SQL and alertable in the log pipeline. Auditing never breaks the
 * action being audited: a failed write is logged loudly instead of thrown.
 */
export class AuditService {
  constructor(
    private readonly repository: AuditRepository,
    private readonly logger: Logger,
    private readonly clock: Clock,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    const context = requestContext.getStore();
    const record = {
      occurredAt: this.clock.now().toISOString(),
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      requestId: context?.requestId ?? null,
      ip: context?.ip ?? null,
      userAgent: context?.userAgent ?? null,
      metadata: entry.metadata ?? {},
    };
    this.logger.info({ audit: record }, `audit ${entry.action}`);
    try {
      await this.repository.append(record);
    } catch (error) {
      this.logger.error({ err: error, audit: record }, "failed to persist audit entry");
    }
  }
}

/** Records sign-ups, sign-ins (and failures), sign-outs and refresh-token reuse. */
export class AuditedAuthService implements AuthApi {
  constructor(
    private readonly inner: AuthApi,
    private readonly audit: AuditService,
  ) {}

  async signUp(input: SignUpInput, meta: ClientMeta) {
    const session = await this.inner.signUp(input, meta);
    await this.audit.record({
      action: "auth.sign_up",
      actorId: session.user.id,
      targetType: "user",
      targetId: session.user.id,
      metadata: { role: session.user.role },
    });
    return session;
  }

  async signIn(input: SignInInput, meta: ClientMeta) {
    try {
      const session = await this.inner.signIn(input, meta);
      await this.audit.record({ action: "auth.sign_in", actorId: session.user.id });
      return session;
    } catch (error) {
      if (error instanceof AppError && error.code === "unauthorized") {
        await this.audit.record({
          action: "auth.sign_in_failed",
          actorId: null,
          metadata: { email: emailFingerprint(input.email) },
        });
      }
      throw error;
    }
  }

  async refresh(refreshToken: string, meta: ClientMeta) {
    try {
      return await this.inner.refresh(refreshToken, meta);
    } catch (error) {
      if (error instanceof TokenReuseError) {
        await this.audit.record({
          action: "auth.refresh_token_reuse",
          actorId: error.userId,
          targetType: "token_family",
          targetId: error.familyId,
        });
      }
      throw error;
    }
  }

  async signOut(refreshToken: string) {
    await this.inner.signOut(refreshToken);
    await this.audit.record({ action: "auth.sign_out", actorId: null });
  }
}
