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

export function installSyncHardening(engine: SyncEngine = syncEngine, now: () => number = Date.now): () => void {
  const offBefore = engine.onBeforeFlush(async () => {
    const { expired, exhausted } = planQuarantine(await pendingEntries(), now());
    await moveToDeadLetter(expired, "expired");
    await moveToDeadLetter(exhausted, "retry_budget_exhausted");
  });

  const offResults = engine.onResults(async (results) => {
    const rejected = results.filter((r) => r.status === "rejected");
    const byReason = new Map<string, string[]>();
    for (const r of rejected) {
      const reason = r.reason ?? "rejected";
      byReason.set(reason, [...(byReason.get(reason) ?? []), r.opId]);
    }
    for (const [reason, ids] of byReason) await moveToDeadLetter(ids, reason);
  });

  return () => {
    offBefore();
    offResults();
  };
}

export const deadLettersKey = ["dead-letters"] as const;

/** Dead letters for the sync status screen, refreshed whenever the outbox changes. */
export function useDeadLetters() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const unsubscribe = subscribeOutbox(() => {
      void queryClient.invalidateQueries({ queryKey: deadLettersKey });
    });
    return () => {
      unsubscribe();
    };
  }, [queryClient]);
  return useQuery({ queryKey: deadLettersKey, queryFn: listDeadLetters, networkMode: "always" });
}
