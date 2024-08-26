import type {
  LessonId,
  SyncOperation,
  SyncOpResult,
  SyncPushInput,
  SyncResponse,
  UserId,
} from "@learnly/shared";
import type { TransactionRunner } from "../../db/sql.js";
import type { Clock } from "../../lib/clock.js";
import { AppError, validationFailed } from "../../lib/errors.js";
import type { Logger } from "../../lib/logger.js";
import type { AttemptSubmitter } from "../attempts/service.js";
import type { CatalogChangeFeed } from "../catalog/repository.js";
import type { ProgressService } from "../progress/service.js";
import type { ProfileApi } from "../users/service.js";
import type { OperationRef, SyncRepository } from "./repository.js";

export interface SyncServiceDeps {
  sync: SyncRepository;
  changes: CatalogChangeFeed;
  attempts: AttemptSubmitter;
  progress: ProgressService;
  profile: ProfileApi;
  transactions: TransactionRunner;
  clock: Clock;
  logger: Logger;
}

/** Cursors are server timestamps; anything else means a confused or tampered client. */
export function parseCursor(since: string | null): string | null {
  if (since === null) return null;
  const at = Date.parse(since);
  if (Number.isNaN(at)) throw validationFailed("The sync cursor isn't valid. Sync again from scratch.", { since });
  return new Date(at).toISOString();
}

export class SyncService {
  constructor(private readonly deps: SyncServiceDeps) {}

  /**
   * Apply a device's outbox, then return everything that changed since its last pull.
   *
   * Operations are applied in the order they happened on the device. Each runs in its
   * own transaction together with its `sync_operations` claim, so a crash mid-batch
   * leaves every operation either fully applied or not applied at all — and a retry
   * picks up exactly where it stopped.
   */
  async push(userId: UserId, input: SyncPushInput): Promise<SyncResponse> {
    const since = parseCursor(input.since);
    const chronological = [...input.operations].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const outcomes = new Map<string, SyncOpResult>();
    for (const op of chronological) {
      // The same op twice in one batch is a client bug, but harmless: the second is a duplicate.
      outcomes.set(op.opId, outcomes.has(op.opId) ? { opId: op.opId, status: "duplicate" } : await this.apply(userId, input.deviceId, op));
    }

    // Taken after applying, so this batch's own writes are never sent back next time.
    const serverTime = this.deps.clock.now().toISOString();
    await this.deps.sync.touchDevice(userId, input.deviceId, serverTime);
    const [mastery, lessons, deletedLessons, progress] = await Promise.all([
      this.deps.sync.masteryChangedSince(userId, since),
      this.deps.changes.lessonsChangedSince(since),
      since === null ? Promise.resolve<LessonId[]>([]) : this.deps.changes.lessonsDeletedSince(since),
      this.deps.progress.summary(userId),
    ]);

    return {
      results: input.operations.map((op) => outcomes.get(op.opId) ?? { opId: op.opId, status: "duplicate" }),
      cursor: serverTime,
      serverTime,
      mastery: { upserted: mastery, deletedIds: [] },
      lessons: { upserted: lessons, deletedIds: deletedLessons },
      progress: {
        totalXp: progress.totalXp,
        streak: progress.streak.current,
        freezesAvailable: progress.streak.freezesAvailable,
      },
    };
  }

  private async apply(userId: UserId, deviceId: string, op: SyncOperation): Promise<SyncOpResult> {
    const ref: OperationRef = { opId: op.opId, deviceId, type: op.type, createdAt: op.createdAt };
    try {
      const applied = await this.deps.transactions.transaction(async () => {
        if (!(await this.deps.sync.claim(userId, ref))) return false;
        await this.execute(userId, op);
        return true;
      });
      if (applied) return { opId: op.opId, status: "applied" };
      const previous = await this.deps.sync.find(userId, op.opId);
      return previous?.status === "rejected"
        ? { opId: op.opId, status: "rejected", reason: previous.reason ?? "rejected" }
        : { opId: op.opId, status: "duplicate" };
    } catch (error) {
      // Server faults bubble up so the client retries later; only business rejections
      // (an unknown item, a finished session…) are recorded as permanently rejected.
      if (!(error instanceof AppError) || error.status >= 500) throw error;
      await this.deps.sync.reject(userId, ref, error.message);
      this.deps.logger.info({ userId, opId: op.opId, type: op.type, code: error.code }, "sync operation rejected");
      return { opId: op.opId, status: "rejected", reason: error.message };
    }
  }
  private async execute(userId: UserId, op: SyncOperation): Promise<void> {
    switch (op.type) {
      case "attempt.create":
        await this.deps.attempts.submit(userId, {
          ...op.payload,
          // The op id doubles as the attempt id, so REST retries and sync replays agree.
          clientAttemptId: op.payload.clientAttemptId ?? op.opId,
          answeredAt: op.payload.answeredAt ?? op.createdAt,
        });
        return;
      case "lesson.complete":
        await this.deps.progress.completeLesson(userId, op.payload.lessonId as LessonId, op.payload.durationMs, op.createdAt);
        return;
      case "preferences.update":
        await this.deps.profile.updatePreferences(userId, op.payload);
        return;
    }
  }
}
