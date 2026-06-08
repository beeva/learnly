import type { AnalyticsEvent } from "../src/lib/api";

const mockSend = jest.fn<Promise<void>, [AnalyticsEvent[]]>();
let mockOnline = true;
const mockKv = new Map<string, unknown>();

jest.mock("../src/lib/api", () => ({ eventsApi: { send: (events: AnalyticsEvent[]) => mockSend(events) } }));
jest.mock("../src/db/schema", () => ({
  kvGet: jest.fn(async (key: string) => mockKv.get(key) ?? null),
  kvSet: jest.fn(async (key: string, value: unknown) => {
    mockKv.set(key, value);
  }),
}));
jest.mock("../src/sync", () => ({
  isOnlineNow: () => mockOnline,
  syncEngine: { getState: () => ({ status: "idle" }), subscribe: () => () => undefined },
}));
jest.mock("../src/sync/outbox", () => ({ subscribeOutbox: () => () => undefined }));

// Imported after the mocks so the module picks them up.
import { analytics, BATCH_SIZE } from "../src/analytics/analytics";
import { updateLocalSettings } from "../src/state/localSettings";

beforeEach(async () => {
  mockSend.mockReset();
  mockSend.mockResolvedValue(undefined);
  mockOnline = true;
  mockKv.clear();
  analytics.reset();
  await updateLocalSettings({ analyticsEnabled: true });
});

describe("analytics", () => {
  it("sends queued events in batches of at most 50", async () => {
    for (let i = 0; i < 120; i++) analytics.track("item_viewed", { index: i });
    const sent = await analytics.flush();
    expect(sent).toBe(120);
    expect(mockSend.mock.calls.map(([batch]) => batch.length)).toEqual([BATCH_SIZE, BATCH_SIZE, 20]);
    expect(analytics.pending()).toBe(0);
    expect(mockSend.mock.calls[0]?.[0][0]).toMatchObject({ name: "item_viewed", props: { index: 0 } });
  });

  it("keeps events when the request fails and retries them next time", async () => {
    analytics.track("lesson_completed");
    mockSend.mockRejectedValueOnce(new Error("offline"));
    expect(await analytics.flush()).toBe(0);
    expect(analytics.pending()).toBe(1);

    expect(await analytics.flush()).toBe(1);
    expect(analytics.pending()).toBe(0);
  });

  it("waits for a connection before sending", async () => {
    mockOnline = false;
    analytics.track("app_opened");
    expect(await analytics.flush()).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
    expect(analytics.pending()).toBe(1);
  });

  it("records nothing and drops the queue when the learner opts out", async () => {
    analytics.track("app_opened");
    await updateLocalSettings({ analyticsEnabled: false });
    analytics.track("attempt_recorded", { offline: true });
    expect(analytics.pending()).toBe(1);
    expect(await analytics.flush()).toBe(0);
    expect(analytics.pending()).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("persists the queue so events survive an app restart", async () => {
    analytics.track("app_opened");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const stored = mockKv.get("analytics.queue") as AnalyticsEvent[] | undefined;
    expect(stored?.map((e) => e.name)).toEqual(["app_opened"]);
  });
});
