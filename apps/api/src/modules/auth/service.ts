import { createHash, randomUUID } from "node:crypto";
import type { SignInInput, SignUpInput, User, UserId } from "@learnly/shared";
import type { TransactionRunner } from "../../db/sql.js";
import type { Clock } from "../../lib/clock.js";
import { AppError, unauthorized } from "../../lib/errors.js";
import type { Logger } from "../../lib/logger.js";
import type { PasswordHasher } from "../../lib/passwords.js";
import { generateRefreshToken, hashToken, type TokenService } from "../../lib/tokens.js";
import type { UserRepository } from "../users/repository.js";
import type { RefreshTokenRecord, RefreshTokenRepository } from "./repository.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession extends TokenPair {
  user: User;
}

export interface ClientMeta {
  userAgent: string | null;
}

export interface AuthApi {
  signUp(input: SignUpInput, meta: ClientMeta): Promise<AuthSession>;
  signIn(input: SignInInput, meta: ClientMeta): Promise<AuthSession>;
  refresh(refreshToken: string, meta: ClientMeta): Promise<TokenPair>;
  signOut(refreshToken: string): Promise<void>;
}

/** A rotated or revoked refresh token was presented again: likely stolen. */
export class TokenReuseError extends AppError {
  constructor(
    readonly userId: UserId,
    readonly familyId: string,
  ) {
    super("unauthorized", "Your session has expired. Please sign in again.");
  }
}

/** Friendly default avatar colours from the brand palette, picked from the email. */
const AVATAR_COLORS = ["#5B5BD6", "#FF7A59", "#2FB67C", "#F5A524", "#8E6CEF", "#3BA3D0"] as const;

function avatarColorFor(email: string): string {
  const digest = createHash("sha1").update(email).digest();
  return AVATAR_COLORS[(digest[0] ?? 0) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

const INVALID_CREDENTIALS = "That email and password don't match. Give it another try.";

export interface AuthServiceDeps {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  transactions: TransactionRunner;
  clock: Clock;
  logger: Logger;
  refreshTtlDays: number;
}

export class AuthService implements AuthApi {
  /** Verified against when an email is unknown so timing doesn't reveal which emails exist. */
  private dummyHash: Promise<string> | null = null;

  constructor(private readonly deps: AuthServiceDeps) {}

  async signUp(input: SignUpInput, meta: ClientMeta): Promise<AuthSession> {
    const passwordHash = await this.deps.hasher.hash(input.password);
    return this.deps.transactions.transaction(async () => {
      const user = await this.deps.users.create({
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        role: input.role,
        gradeBand: input.gradeBand,
        avatarColor: avatarColorFor(input.email),
        locale: "en",
      });
      this.deps.logger.info({ userId: user.id, role: user.role }, "account created");
      return { user, ...(await this.issueTokens(user, randomUUID(), meta)) };
    });
  }

  async signIn(input: SignInInput, meta: ClientMeta): Promise<AuthSession> {
    const found = await this.deps.users.findByEmail(input.email);
    if (!found) {
      this.dummyHash ??= this.deps.hasher.hash("timing-equaliser-0000");
      await this.deps.hasher.verify(await this.dummyHash, input.password);
      throw unauthorized(INVALID_CREDENTIALS);
    }
    const valid = await this.deps.hasher.verify(found.passwordHash, input.password);
    if (!valid) throw unauthorized(INVALID_CREDENTIALS);
    return { user: found.user, ...(await this.issueTokens(found.user, randomUUID(), meta)) };
  }

  protected async issueTokens(user: User, familyId: string, meta: ClientMeta): Promise<TokenPair> {
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(this.deps.clock.now().getTime() + this.deps.refreshTtlDays * 86_400_000);
    await this.deps.refreshTokens.insert({
      userId: user.id,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt: expiresAt.toISOString(),
      userAgent: meta.userAgent,
    });
    return { accessToken: this.deps.tokens.signAccessToken(user.id, user.role), refreshToken };
  }
  /**
   * Refresh-token rotation (OAuth 2.0 Security BCP §4.14): every refresh consumes the
   * presented token and issues a new one in the same family. If a consumed token is ever
   * presented again, someone has a copy — so the whole family is revoked and both the
   * attacker and the real user must sign in again.
   */
  async refresh(refreshToken: string, meta: ClientMeta): Promise<TokenPair> {
    const record = await this.deps.refreshTokens.findByHash(hashToken(refreshToken));
    if (!record) throw unauthorized("Your session has expired. Please sign in again.");
    if (record.rotatedAt !== null || record.revokedAt !== null) {
      await this.revokeForReuse(record);
    }
    const now = this.deps.clock.now();
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      throw unauthorized("Your session has expired. Please sign in again.");
    }

    const pair = await this.deps.transactions.transaction(async () => {
      const rotated = await this.deps.refreshTokens.markRotated(record.id, now.toISOString());
      if (!rotated) return null; // lost a race with a concurrent refresh of the same token
      const user = await this.deps.users.findById(record.userId);
      if (!user) throw unauthorized();
      return this.issueTokens(user, record.familyId, meta);
    });
    if (!pair) await this.revokeForReuse(record);
    return pair!;
  }

  async signOut(refreshToken: string): Promise<void> {
    const record = await this.deps.refreshTokens.findByHash(hashToken(refreshToken));
    if (!record || record.revokedAt !== null) return;
    await this.deps.refreshTokens.revokeFamily(record.familyId, "signed_out", this.deps.clock.now().toISOString());
  }

  private async revokeForReuse(record: RefreshTokenRecord): Promise<never> {
    const revoked = await this.deps.refreshTokens.revokeFamily(
      record.familyId,
      "reuse_detected",
      this.deps.clock.now().toISOString(),
    );
    this.deps.logger.warn(
      { userId: record.userId, familyId: record.familyId, revoked },
      "refresh token reuse detected; token family revoked",
    );
    throw new TokenReuseError(record.userId, record.familyId);
  }
}
