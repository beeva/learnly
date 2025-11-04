import { describe, expect, it } from "vitest";
import { attemptInputSchema, signUpSchema } from "../src/schemas.js";

describe("signUpSchema", () => {
  it("normalises email and defaults the role", () => {
    const parsed = signUpSchema.parse({
      email: "  Maya@Example.COM ",
      password: "fractions123",
      displayName: "Maya",
    });
    expect(parsed.email).toBe("maya@example.com");
    expect(parsed.role).toBe("student");
    expect(parsed.gradeBand).toBeNull();
  });

  it("explains weak passwords in plain language", () => {
    const result = signUpSchema.safeParse({ email: "a@b.co", password: "short", displayName: "A" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Use at least 10 characters");
  });
});

describe("attemptInputSchema", () => {
  const base = { itemId: "6f1c2a8e-5b7d-4e0a-9c3f-1a2b3c4d5e6f", durationMs: 12_000 };

  it("accepts each response kind", () => {
    for (const response of [
      { kind: "multiple_choice", choiceId: "b" },
      { kind: "numeric", value: 0.75 },
      { kind: "short_text", text: "photosynthesis" },
      { kind: "ordering", order: ["a", "c", "b"] },
    ]) {
      expect(attemptInputSchema.safeParse({ ...base, response }).success).toBe(true);
    }
  });

  it("rejects non-finite numeric answers", () => {
    const result = attemptInputSchema.safeParse({ ...base, response: { kind: "numeric", value: Infinity } });
    expect(result.success).toBe(false);
  });
});
import { joinClassroomSchema } from "../src/schemas.js";

describe("joinClassroomSchema", () => {
  it("upper-cases and trims codes", () => {
    expect(joinClassroomSchema.parse({ joinCode: " k7mq4r " }).joinCode).toBe("K7MQ4R");
  });

  it("rejects ambiguous characters like O and 1", () => {
    expect(joinClassroomSchema.safeParse({ joinCode: "O1MQ4R" }).success).toBe(false);
  });
});
