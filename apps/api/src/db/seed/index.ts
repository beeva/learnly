/**
 * Seeds the catalog and demo accounts. Safe to run repeatedly: ids are derived from
 * content keys, every write is an upsert, and content removed from the seed files is
 * removed (lessons) or retired (items keep their history for analytics).
 *
 *   pnpm --filter @learnly/api db:seed
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { argon2Hasher } from "../../lib/passwords.js";
import { itemBody } from "../../modules/catalog/repository.js";
import { Database } from "../sql.js";
import { fractions } from "./fractions.js";
import { materializeCourse, seedId, type MaterializedCourse, type SeedCourse } from "./types.js";

export interface SeedContext {
  db: Database;
  log: (message: string) => void;
}

export type SeedStep = (context: SeedContext) => Promise<void>;

/** Courses to seed, in display order. */
export const SEED_COURSES: SeedCourse[] = [fractions];

/** Extra steps (demo classrooms, sample activity…) run after the catalog. */
export const SEED_STEPS: SeedStep[] = [];

export const DEMO_PASSWORD = "learnly-demo-2024";

export async function writeCourse(db: Database, content: MaterializedCourse): Promise<void> {
  const { course } = content;
  await db.query(
    `insert into courses (id, slug, title, subject, grade_band, description, cover_hue, position)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (id) do update set
       slug = excluded.slug, title = excluded.title, subject = excluded.subject,
       grade_band = excluded.grade_band, description = excluded.description,
       cover_hue = excluded.cover_hue, position = excluded.position, updated_at = now()`,
    [course.id, course.slug, course.title, course.subject, course.gradeBand, course.description, course.coverHue, course.position],
  );

  for (const unit of content.units) {
    await db.query(
      `insert into units (id, course_id, position, title, summary) values ($1, $2, $3, $4, $5)
       on conflict (id) do update set position = excluded.position, title = excluded.title, summary = excluded.summary`,
      [unit.id, unit.courseId, unit.position, unit.title, unit.summary],
    );
  }

  for (const skill of content.skills) {
    await db.query(
      `insert into skills (id, unit_id, code, name, position) values ($1, $2, $3, $4, $5)
       on conflict (id) do update set unit_id = excluded.unit_id, code = excluded.code,
         name = excluded.name, position = excluded.position`,
      [skill.id, skill.unitId, skill.code, skill.name, skill.position],
    );
  }
  // Prerequisites can point at skills later in the list, so insert them once all exist.
  for (const skill of content.skills) {
    await db.query("delete from skill_prerequisites where skill_id = $1", [skill.id]);
    for (const prerequisiteId of skill.prerequisiteIds) {
      await db.query("insert into skill_prerequisites (skill_id, prerequisite_id) values ($1, $2)", [
        skill.id,
        prerequisiteId,
      ]);
    }
  }

  for (const item of content.items) {
    await db.query(
      `insert into items (id, skill_id, kind, prompt, difficulty, body, hints, explanation, active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, true)
       on conflict (id) do update set
         skill_id = excluded.skill_id, kind = excluded.kind, prompt = excluded.prompt,
         difficulty = excluded.difficulty, body = excluded.body, hints = excluded.hints,
         explanation = excluded.explanation, active = true, updated_at = now()`,
      [
        item.id,
        item.skillId,
        item.kind,
        item.prompt,
        item.difficulty,
        JSON.stringify(itemBody(item)),
        JSON.stringify(item.hints),
        item.explanation,
      ],
    );
  }

  for (const lesson of content.lessons) {
    // Only bump updated_at when the lesson really changed, so offline caches stay warm.
    await db.query(
      `insert into lessons (id, skill_id, slug, title, level, estimated_minutes, blocks, position)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (id) do update set
         skill_id = excluded.skill_id, slug = excluded.slug, title = excluded.title,
         level = excluded.level, estimated_minutes = excluded.estimated_minutes,
         blocks = excluded.blocks, position = excluded.position, updated_at = now()
       where (lessons.title, lessons.level, lessons.estimated_minutes, lessons.blocks, lessons.position)
             is distinct from (excluded.title, excluded.level, excluded.estimated_minutes, excluded.blocks, excluded.position)`,
      [
        lesson.id,
        lesson.skillId,
        lesson.slug,
        lesson.title,
        lesson.level,
        lesson.estimatedMinutes,
        JSON.stringify(lesson.blocks),
        lesson.position,
      ],
    );
  }

  const skillIds = content.skills.map((skill) => skill.id);
  await db.query("update items set active = false where skill_id = any($1::uuid[]) and id <> all($2::uuid[])", [
    skillIds,
    content.items.map((item) => item.id),
  ]);
  await db.query("delete from lessons where skill_id = any($1::uuid[]) and id <> all($2::uuid[])", [
    skillIds,
    content.lessons.map((lesson) => lesson.id),
  ]);
}

export async function upsertDemoUser(
  db: Database,
  user: { email: string; displayName: string; role: "student" | "educator"; gradeBand: string | null; avatarColor: string },
): Promise<string> {
  const id = seedId("demo-user", user.email);
  const passwordHash = await argon2Hasher.hash(DEMO_PASSWORD);
  await db.query(
    `insert into users (id, email, password_hash, display_name, role, grade_band, avatar_color)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (id) do update set display_name = excluded.display_name, password_hash = excluded.password_hash`,
    [id, user.email, passwordHash, user.displayName, user.role, user.gradeBand, user.avatarColor],
  );
  await db.query("insert into user_preferences (user_id) values ($1) on conflict do nothing", [id]);
  return id;
}

export async function runSeed(context: SeedContext): Promise<void> {
  await context.db.transaction(async () => {
    for (const seed of SEED_COURSES) {
      const content = materializeCourse(seed);
      await writeCourse(context.db, content);
      context.log(
        `  ${content.course.title}: ${content.units.length} units, ${content.skills.length} skills, ` +
          `${content.lessons.length} lessons, ${content.items.length} items`,
      );
    }
    await upsertDemoUser(context.db, {
      email: "maya@demo.learnly.app",
      displayName: "Maya",
      role: "student",
      gradeBand: "3-5",
      avatarColor: "#FF7A59",
    });
    context.log(`  demo learner: maya@demo.learnly.app / ${DEMO_PASSWORD}`);
    for (const step of SEED_STEPS) await step(context);
  });
}

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const db = new Database({ connectionString: databaseUrl, max: 2 });
  try {
    console.log("Seeding Learnly…");
    await runSeed({ db, log: (message) => console.log(message) });
    console.log("Seed complete.");
  } finally {
    await db.close();
  }
}

const invokedDirectly = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  // Deferred so courses and steps registered further down this module are included.
  setImmediate(() => {
    main().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
}

import { preAlgebra } from "./pre-algebra.js";
import { readingDetectives } from "./reading.js";

SEED_COURSES.push(preAlgebra, readingDetectives);

import { applyAttempt, initialMastery } from "@learnly/adaptive-engine";
import { xpForAttempt, type SkillMastery } from "@learnly/shared";
import { earthScience } from "./earth-science.js";

SEED_COURSES.push(earthScience);

/**
 * A demo educator with a classroom of three learners and a week of realistic activity,
 * so the insights dashboard has something to show on a fresh environment.
 */
SEED_STEPS.push(async ({ db, log }) => {
  const educatorId = await upsertDemoUser(db, {
    email: "ms.rivera@demo.learnly.app",
    displayName: "Ms. Rivera",
    role: "educator",
    gradeBand: null,
    avatarColor: "#5B5BD6",
  });
  const learners = [
    { email: "maya@demo.learnly.app", displayName: "Maya", accuracy: 0.85, avatarColor: "#FF7A59" },
    { email: "jonah@demo.learnly.app", displayName: "Jonah", accuracy: 0.6, avatarColor: "#2FB67C" },
    { email: "priya@demo.learnly.app", displayName: "Priya", accuracy: 0.35, avatarColor: "#F5A524" },
  ];
  const course = materializeCourse(fractions);
  const classroomId = seedId("classroom", "rivera-fractions");
  await db.query(
    `insert into classrooms (id, name, educator_id, course_id, join_code)
     values ($1, $2, $3, $4, $5)
     on conflict (id) do update set name = excluded.name`,
    [classroomId, "Room 12 · Fractions", educatorId, course.course.id, "FRAC24"],
  );

  const practisedSkills = new Set(["FR.1", "FR.2", "FR.3", "FR.5"].map((code) => seedId("skill", code)));
  const items = course.items.filter((item) => practisedSkills.has(item.skillId));
  const perDay = 6;
  const days = Math.ceil(items.length / perDay);
  const now = Date.now();

  for (const [learnerIndex, learner] of learners.entries()) {
    const userId = await upsertDemoUser(db, { ...learner, role: "student", gradeBand: "3-5" });
    await db.query("insert into classroom_members (classroom_id, user_id) values ($1, $2) on conflict do nothing", [
      classroomId,
      userId,
    ]);
    // Deterministic pseudo-random answers so the dashboard looks the same on every seed.
    let state = 17 + learnerIndex * 31;
    const random = () => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    };
    const mastery = new Map<string, SkillMastery>();
    const activity = new Map<string, { seconds: number; answered: number; correct: number }>();
    let totalXp = 0;

    // Oldest first, so mastery evolves in the same order the answers were given.
    for (const [index, item] of items.entries()) {
      const correct = random() < learner.accuracy;
      const durationMs = 20_000 + Math.round(random() * 40_000);
      const answeredAt = new Date(now - (days - Math.floor(index / perDay)) * 86_400_000 + index * 180_000);
      const before = mastery.get(item.skillId) ?? initialMastery(item.skillId);
      await db.query(
        `insert into attempts (user_id, item_id, skill_id, client_attempt_id, response, correct, hints_used,
                               duration_ms, ability_before, answered_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict do nothing`,
        [
          userId,
          item.id,
          item.skillId,
          seedId("demo-attempt", `${learner.email}:${item.id}`),
          JSON.stringify(correct ? correctDemoResponse(item) : wrongDemoResponse(item)),
          correct,
          correct ? 0 : 1,
          durationMs,
          before.ability,
          answeredAt.toISOString(),
        ],
      );
      mastery.set(
        item.skillId,
        applyAttempt(before, { difficulty: item.difficulty, correct, hintsUsed: correct ? 0 : 1, answeredAt: answeredAt.toISOString() }),
      );
      const day = answeredAt.toISOString().slice(0, 10);
      const today = activity.get(day) ?? { seconds: 0, answered: 0, correct: 0 };
      activity.set(day, {
        seconds: today.seconds + Math.round(durationMs / 1000),
        answered: today.answered + 1,
        correct: today.correct + (correct ? 1 : 0),
      });
      totalXp += xpForAttempt(correct, correct ? 0 : 1, true);
    }

    for (const skillState of mastery.values()) {
      await db.query(
        `insert into skill_mastery (user_id, skill_id, p_known, ability, band, attempts, last_practiced_at)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (user_id, skill_id) do update set p_known = excluded.p_known, ability = excluded.ability,
           band = excluded.band, attempts = excluded.attempts, last_practiced_at = excluded.last_practiced_at,
           updated_at = now()`,
        [
          userId,
          skillState.skillId,
          skillState.pKnown,
          skillState.ability,
          skillState.band,
          skillState.attempts,
          skillState.lastPracticedAt,
        ],
      );
    }
    for (const [day, totals] of activity) {
      await db.query(
        `insert into daily_activity (user_id, day, active_seconds, items_answered, items_correct)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id, day) do update set active_seconds = excluded.active_seconds,
           items_answered = excluded.items_answered, items_correct = excluded.items_correct`,
        [userId, day, totals.seconds, totals.answered, totals.correct],
      );
    }
    const lastDay = [...activity.keys()].sort().at(-1) ?? null;
    await db.query(
      `insert into user_progress (user_id, total_xp, streak_current, streak_longest, last_active_day)
       values ($1, $2, $3, $3, $4)
       on conflict (user_id) do update set total_xp = excluded.total_xp, streak_current = excluded.streak_current,
         streak_longest = greatest(user_progress.streak_longest, excluded.streak_longest),
         last_active_day = excluded.last_active_day`,
      [userId, totalXp, activity.size, lastDay],
    );
  }
  log("  demo educator: ms.rivera@demo.learnly.app (classroom code FRAC24)");
});

type DemoItem = MaterializedCourse["items"][number];

function correctDemoResponse(item: DemoItem): unknown {
  switch (item.kind) {
    case "multiple_choice":
      return { kind: item.kind, choiceId: item.answer };
    case "numeric":
      return { kind: item.kind, value: item.answer };
    case "short_text":
      return { kind: item.kind, text: item.acceptedAnswers[0] ?? "" };
    case "ordering":
      return { kind: item.kind, order: item.answer };
  }
}

/** The most tempting wrong answer, so the misconception view has a clear signal. */
function wrongDemoResponse(item: DemoItem): unknown {
  switch (item.kind) {
    case "multiple_choice":
      return { kind: item.kind, choiceId: item.choices.find((choice) => choice.id !== item.answer)?.id ?? "b" };
    case "numeric":
      return { kind: item.kind, value: item.answer + 1 };
    case "short_text":
      return { kind: item.kind, text: "2/8" };
    case "ordering":
      return { kind: item.kind, order: [...item.answer].reverse() };
  }
}
