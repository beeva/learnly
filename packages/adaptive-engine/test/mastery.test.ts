import { describe, expect, it } from "vitest";
import type { SkillId } from "@learnly/shared";
import { applyAttempt, bandFor, initialMastery } from "../src/mastery.js";

const skill = "skill-fractions-equivalent" as SkillId;

describe("bandFor", () => {
  it("labels unseen skills as new", () => {
    expect(bandFor(0.99, 0)).toBe("new");
  });

  it("requires a few attempts before calling something mastered", () => {
    expect(bandFor(0.9, 2)).toBe("practicing");
    expect(bandFor(0.9, 4)).toBe("mastered");
  });
});

