import { describe, expect, it } from "vitest";
import type { Item, MultipleChoiceItem } from "@learnly/shared";
import { correctResponseFor, createHarness, type Harness, type TestAccount } from "./support/harness.js";

async function classroomFixture() {
  const harness = createHarness();
  const educator = await harness.signUp({ role: "educator", displayName: "Ms. Rivera" });
  const course = harness.store.catalog.courseBySlug("fractions-foundations");
  const created = await harness.api
    .post("/v1/classrooms")
    .set(educator.auth)
    .send({ name: "Room 12 · Fractions", courseId: course.id });
  expect(created.status).toBe(201);
  return { harness, educator, classroom: created.body.classroom as { id: string; joinCode: string } };
}

async function join(harness: Harness, joinCode: string, displayName: string): Promise<TestAccount> {
  const student = await harness.signUp({ displayName });
  const res = await harness.api.post("/v1/classrooms/join").set(student.auth).send({ joinCode: joinCode.toLowerCase() });
  expect(res.status).toBe(200);
  return student;
}

describe("classrooms", () => {
  it("lets an educator create a classroom with a readable join code", async () => {
    const { harness, educator, classroom } = await classroomFixture();
    expect(classroom.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const list = await harness.api.get("/v1/classrooms").set(educator.auth);
    expect(list.body.classrooms).toEqual([expect.objectContaining({ id: classroom.id, studentCount: 0 })]);
    expect(harness.store.audit.actions()).toContain("classroom.create");
  });

  it("lets students join by code (case-insensitively, idempotently)", async () => {
    const { harness, educator, classroom } = await classroomFixture();
    const student = await join(harness, classroom.joinCode, "Jonah");
    const again = await harness.api.post("/v1/classrooms/join").set(student.auth).send({ joinCode: classroom.joinCode });
    expect(again.body.classroom.studentCount).toBe(1);

    const mine = await harness.api.get("/v1/classrooms").set(student.auth);
    expect(mine.body.classrooms.map((c: { id: string }) => c.id)).toEqual([classroom.id]);
    const members = await harness.api.get(`/v1/classrooms/${classroom.id}/members`).set(educator.auth);
    expect(members.body.members).toEqual([expect.objectContaining({ displayName: "Jonah" })]);

    const typo = await harness.api.post("/v1/classrooms/join").set(student.auth).send({ joinCode: "ZZZZZZ" });
    expect(typo.status).toBe(404);
    const malformed = await harness.api.post("/v1/classrooms/join").set(student.auth).send({ joinCode: "O0O0" });
    expect(malformed.status).toBe(400);
  });

  it("keeps classroom data to its own educator", async () => {
    const { harness, classroom } = await classroomFixture();
    const student = await join(harness, classroom.joinCode, "Priya");
    const otherEducator = await harness.signUp({ role: "educator" });

    expect((await harness.api.post("/v1/classrooms").set(student.auth).send({ name: "Mine", courseId: classroom.id })).status).toBe(403);
    expect((await harness.api.get(`/v1/classrooms/${classroom.id}/insights`).set(student.auth)).status).toBe(403);
    expect((await harness.api.get(`/v1/classrooms/${classroom.id}/members`).set(otherEducator.auth)).status).toBe(404);
    expect((await harness.api.post("/v1/classrooms/join").set(otherEducator.auth).send({ joinCode: classroom.joinCode })).status).toBe(403);

    const admin = await harness.signUp({ role: "educator" });
    harness.store.users.setRole(admin.user.id, "admin");
    const asAdmin = await harness.api
      .post("/v1/auth/sign-in")
      .send({ email: admin.user.email, password: "fractions4ever" });
    const adminView = await harness.api
      .get(`/v1/classrooms/${classroom.id}/members`)
      .set({ Authorization: `Bearer ${asAdmin.body.accessToken}` });
    expect(adminView.status).toBe(200);
  });
});

function choiceByText(item: Item, text: string): string {
  const choice = (item as MultipleChoiceItem).choices.find((c) => c.text === text);
  if (!choice) throw new Error(`no choice ${text}`);
  return choice.id;
}

describe("classroom insights", () => {
  it("surfaces struggling skills, the dominant misconception and students to check in on", async () => {
    const { harness, educator, classroom } = await classroomFixture();
    const students = [
      await join(harness, classroom.joinCode, "Ava"),
      await join(harness, classroom.joinCode, "Ben"),
      await join(harness, classroom.joinCode, "Cleo"),
    ];
    await join(harness, classroom.joinCode, "Dev"); // joined but never practised

    const items = harness.store.catalog.itemsOfSkill("FR.5");
    const trap = items.find((item) => item.prompt === "What is 1/4 + 1/4?")!;
    const easy = items.find((item) => item.kind === "short_text")!;
    for (const student of students) {
      await harness.api
        .post("/v1/attempts")
        .set(student.auth)
        .send({ itemId: trap.id, response: { kind: "multiple_choice", choiceId: choiceByText(trap, "2/8") }, durationMs: 20_000 });
      await harness.api
        .post("/v1/attempts")
        .set(student.auth)
        .send({ itemId: easy.id, response: correctResponseFor(easy), durationMs: 20_000 });
    }
    harness.clock.advance(60_000);

    const res = await harness.api.get(`/v1/classrooms/${classroom.id}/insights`).set(educator.auth);
    expect(res.status).toBe(200);
    const insights = res.body;
    expect(insights.hotspots).toEqual([
      expect.objectContaining({
        skillName: "Adding and subtracting like fractions",
        errorRate: 0.5,
        commonMisconception: expect.stringContaining("2/8"),
      }),
    ]);
    expect(insights.students).toHaveLength(4);
    expect(insights.students[0]).toMatchObject({ displayName: "Dev", needsAttention: true, lastActiveAt: null });
    expect(insights.students.slice(1).every((s: { needsAttention: boolean }) => !s.needsAttention)).toBe(true);
    const total = Object.values(insights.masteryDistribution as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(total).toBe(4 * 6);
  });

  it("validates the insights window", async () => {
    const { harness, educator, classroom } = await classroomFixture();
    const backwards = await harness.api
      .get(`/v1/classrooms/${classroom.id}/insights?from=2024-03-10&to=2024-03-01`)
      .set(educator.auth);
    expect(backwards.status).toBe(400);
    const huge = await harness.api.get(`/v1/classrooms/${classroom.id}/insights?from=2023-01-01`).set(educator.auth);
    expect(huge.status).toBe(400);
  });

  it("builds a student × skill heatmap and a csv export that is audited", async () => {
    const { harness, educator, classroom } = await classroomFixture();
    const student = await join(harness, classroom.joinCode, "=cmd|' /C calc'!A0");
    const item = harness.store.catalog.itemsOfSkill("FR.1")[0]!;
    await harness.api.post("/v1/attempts").set(student.auth).send({ itemId: item.id, response: correctResponseFor(item), durationMs: 5000 });

    const heatmap = await harness.api.get(`/v1/classrooms/${classroom.id}/heatmap`).set(educator.auth);
    expect(heatmap.body.skills).toHaveLength(6);
    expect(heatmap.body.cells).toHaveLength(6);
    expect(heatmap.body.cells.filter((c: { band: string }) => c.band !== "new")).toHaveLength(1);

    const csv = await harness.api.get(`/v1/classrooms/${classroom.id}/export.csv`).set(educator.auth);
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    expect(csv.headers["content-disposition"]).toMatch(/attachment; filename="room-12-fractions-/);
    const [header, row] = csv.text.replace(/^﻿/, "").trim().split("\r\n");
    expect(header).toMatch(/^Student,Minutes this week,/);
    // Spreadsheet formula injection is neutralised.
    expect(row?.startsWith("'=cmd")).toBe(true);
    expect(harness.store.audit.actions()).toContain("classroom.export");
  });
});
