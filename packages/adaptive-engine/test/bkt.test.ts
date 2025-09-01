import { describe, expect, it } from "vitest";
import { bktUpdate, DEFAULT_BKT, fitBkt, paramsForItem } from "../src/bkt.js";

describe("bktUpdate", () => {
  it("raises belief after a correct answer", () => {
    expect(bktUpdate(0.3, true)).toBeGreaterThan(0.3);
  });

  it("still allows learning after a miss", () => {
    const after = bktUpdate(0.3, false);
    expect(after).toBeLessThan(0.3);
    expect(after).toBeGreaterThanOrEqual(DEFAULT_BKT.pTransit);
  });
});

