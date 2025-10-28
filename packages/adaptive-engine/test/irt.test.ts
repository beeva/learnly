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

describe("updateAbility", () => {
  it("moves up after a correct answer and down after a miss", () => {
    expect(updateAbility(0, 0, true, 0).ability).toBeGreaterThan(0);
    expect(updateAbility(0, 0, false, 0).ability).toBeLessThan(0);
  });

  it("moves less when the answer was expected", () => {
    const surprising = updateAbility(0, 2, true, 3).ability;
    const expected = updateAbility(0, -2, true, 3).ability;
    expect(surprising).toBeGreaterThan(expected);
  });

  it("treats hinted correct answers as partial evidence", () => {
    expect(updateAbility(0, 0, true, 0, 2).ability).toBeLessThan(updateAbility(0, 0, true, 0, 0).ability);
  });

  it("shrinks the step size as evidence accumulates", () => {
    expect(kFactor(0)).toBeGreaterThan(kFactor(10));
    expect(kFactor(1000)).toBe(0.15);
  });
});
import { calibrateDifficulty } from "../src/irt.js";

describe("calibrateDifficulty", () => {
  it("stays at the authored value with no responses", () => {
    expect(calibrateDifficulty(0.4, [])).toBeCloseTo(0.4);
  });

  it("raises difficulty when capable learners keep missing", () => {
    const responses = Array.from({ length: 40 }, () => ({ ability: 1, correct: false }));
    expect(calibrateDifficulty(0, responses)).toBeGreaterThan(1);
  });
});
