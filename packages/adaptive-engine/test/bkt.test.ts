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

describe("paramsForItem", () => {
  it("uses 1/k for multiple choice", () => {
    expect(paramsForItem(DEFAULT_BKT, "multiple_choice", 3).pGuess).toBeCloseTo(1 / 3);
  });

  it("makes free-response items hard to guess", () => {
    expect(paramsForItem(DEFAULT_BKT, "numeric").pGuess).toBe(0.05);
  });
});

describe("fitBkt", () => {
  it("finds a high transit rate for quick learners", () => {
    const sequences = Array.from({ length: 60 }, () => [false, true, true, true, true, true]);
    expect(fitBkt(sequences, 5).pTransit).toBeGreaterThan(0.2);
  });
});
