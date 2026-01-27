import type { UserId } from "@learnly/shared";
import type { Database } from "../../db/sql.js";

export type EventProps = Record<string, string | number | boolean>;

export interface AnalyticsEvent {
  name: string;
  at: string;
  props: EventProps;
}

export interface EventRepository {
  insertBatch(userId: UserId | null, events: AnalyticsEvent[]): Promise<number>;
}

export class PgEventRepository implements EventRepository {
  constructor(private readonly db: Database) {}

  /** One statement per batch: arrays are unnested server-side. */
  async insertBatch(userId: UserId | null, events: AnalyticsEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    const rows = await this.db.query(
      `insert into analytics_events (user_id, name, occurred_at, props)
       select $1::uuid, e.name, e.occurred_at, e.props
         from unnest($2::text[], $3::timestamptz[], $4::jsonb[]) as e(name, occurred_at, props)
       returning id`,
      [
        userId,
        events.map((event) => event.name),
        events.map((event) => event.at),
        events.map((event) => JSON.stringify(event.props)),
      ],
    );
    return rows.length;
  }
}
