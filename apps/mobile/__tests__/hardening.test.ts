import { randomUUID } from "node:crypto";
import { SYNC_RETENTION_DAYS, type SyncOperation } from "@learnly/shared";
import { MAX_TRIES, planQuarantine } from "../src/sync/hardening";

const NOW = Date.UTC(2025, 5, 1, 12, 0);
const DAY = 86_400_000;

function op(ageDays: number): SyncOperation {
  return {
    opId: randomUUID(),
    type: "lesson.complete",
    createdAt: new Date(NOW - ageDays * DAY).toISOString(),
    payload: { lessonId: randomUUID(), durationMs: 90_000 },
  };
}

describe("planQuarantine", () => {
  it("moves operations past the retention window to dead letters", () => {
    const old = op(SYNC_RETENTION_DAYS + 1);
    const fresh = op(2);
    const plan = planQuarantine(
      [
        { op: old, tries: 1 },
        { op: fresh, tries: 1 },
      ],
      NOW,
    );
    expect(plan).toEqual({ expired: [old.opId], exhausted: [] });
  });

  it("parks operations that used up their retry budget", () => {
    const tired = op(1);
    const plan = planQuarantine(
      [
        { op: tired, tries: MAX_TRIES },
        { op: op(1), tries: MAX_TRIES - 1 },
      ],
      NOW,
    );
    expect(plan).toEqual({ expired: [], exhausted: [tired.opId] });
  });

  it("reports an op only once, preferring expiry", () => {
    const both = op(SYNC_RETENTION_DAYS + 3);
    expect(planQuarantine([{ op: both, tries: MAX_TRIES + 2 }], NOW)).toEqual({ expired: [both.opId], exhausted: [] });
  });

  it("keeps everything when the outbox is healthy", () => {
    expect(planQuarantine([{ op: op(0), tries: 0 }], NOW)).toEqual({ expired: [], exhausted: [] });
  });
});
