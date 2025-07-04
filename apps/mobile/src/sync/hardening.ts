import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isExpiredOperation } from "@learnly/shared";
import type { SyncEngine } from "./engine";
import {
  listDeadLetters,
  moveToDeadLetter,
  pendingEntries,
  subscribeOutbox,
  type OutboxEntry,
} from "./outbox";
import { syncEngine } from "./index";

/** After this many pushes an op is parked instead of retried forever. */
export const MAX_TRIES = 8;

/**
 * Decides which pending operations should leave the retry loop. Expired ops would
 * be refused by the server's retention window; exhausted ops keep failing for a
 * reason retries won't fix. Both are kept as dead letters, never deleted.
 */
export function planQuarantine(
  entries: Pick<OutboxEntry, "op" | "tries">[],
  now: number,
): { expired: string[]; exhausted: string[] } {
  const expired: string[] = [];
  const exhausted: string[] = [];
  for (const entry of entries) {
    if (isExpiredOperation(entry.op, now)) expired.push(entry.op.opId);
    else if (entry.tries >= MAX_TRIES) exhausted.push(entry.op.opId);
  }
  return { expired, exhausted };
}

