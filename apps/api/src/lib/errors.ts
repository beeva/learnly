export type ErrorCode =
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  validation_failed: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
};

/** The single error envelope every endpoint returns (see tools/API.md). */
export interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown };
}

/**
 * An error that is safe to show to the client. Messages are written for people, in
 * the same warm tone as the apps — they are rendered as-is in toasts and forms.
 */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    status?: number,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status ?? STATUS_BY_CODE[code];
  }

  toBody(): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

export function validationFailed(message: string, details?: unknown): AppError {
  return new AppError("validation_failed", message, details);
}

export function unauthorized(message = "Please sign in to continue."): AppError {
  return new AppError("unauthorized", message);
}

export function forbidden(message = "You don't have access to this."): AppError {
  return new AppError("forbidden", message);
}

export function notFound(what = "page"): AppError {
  return new AppError("not_found", `We couldn't find that ${what}.`);
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError("conflict", message, details);
}

export function rateLimited(retryAfterSeconds: number): AppError {
  return new AppError("rate_limited", "You're going a little fast — try again in a moment.", {
    retryAfterSeconds,
  });
}

export function internal(message = "Something went wrong on our side. Please try again."): AppError {
  return new AppError("internal", message);
}
