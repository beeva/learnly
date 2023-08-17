import { describe, expect, it } from "vitest";
import { kFactor, probabilityCorrect, updateAbility } from "../src/irt.js";

describe("probabilityCorrect", () => {
  it("is 50% when ability equals difficulty", () => {
    expect(probabilityCorrect(1.2, 1.2)).toBeCloseTo(0.5);
  });

  it("is monotonic in ability", () => {
    expect(probabilityCorrect(1, 0)).toBeGreaterThan(probabilityCorrect(0, 0));
  });
});

