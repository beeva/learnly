import { z } from "zod";
import type { UserId } from "@learnly/shared";
import type { Clock } from "../../lib/clock.js";
import type { Metrics } from "../../lib/metrics.js";
import type { AnalyticsEvent, EventRepository } from "./repository.js";

const propValue = z.union([z.string().max(200), z.number().finite(), z.boolean()]);

export const eventBatchSchema = z.object({
  events: z
    .array(
      z.object({
        name: z.string().regex(/^[a-z][a-z0-9_.]{1,63}$/, "Event names are lower_snake.case"),
        at: z.string().datetime(),
        props: z
          .record(propValue)
          .refine((props) => Object.keys(props).length <= 20, "At most 20 props per event")
          .optional(),
      }),
    )
    .min(1)
    .max(100),
});

export type EventBatch = z.infer<typeof eventBatchSchema>;

/** Events queued offline for longer than this are dropped rather than skewing dashboards. */
const MAX_AGE_MS = 7 * 86_400_000;
const MAX_FUTURE_MS = 5 * 60_000;

export interface IngestResult {
  accepted: number;
  dropped: number;
}

export class EventsService {
  constructor(
    private readonly events: EventRepository,
    private readonly clock: Clock,
    private readonly metrics: Metrics,
  ) {}

  async ingest(userId: UserId | null, batch: EventBatch): Promise<IngestResult> {
    const now = this.clock.now().getTime();
    const fresh: AnalyticsEvent[] = batch.events
      .filter((event) => {
        const at = Date.parse(event.at);
        return at >= now - MAX_AGE_MS && at <= now + MAX_FUTURE_MS;
      })
      .map((event) => ({ name: event.name, at: event.at, props: event.props ?? {} }));
    const accepted = await this.events.insertBatch(userId, fresh);
    const dropped = batch.events.length - accepted;
    this.metrics.analyticsEvents.inc({ outcome: "accepted" }, accepted);
    if (dropped > 0) this.metrics.analyticsEvents.inc({ outcome: "dropped" }, dropped);
    return { accepted, dropped };
  }
}
