import { randomUUID } from "node:crypto";
import type { Candidate } from "@learnly/adaptive-engine";
import type {
  Attempt,
  AttemptId,
  Course,
  CourseId,
  Item,
  ItemId,
  Lesson,
  LessonId,
  Role,
  Skill,
  SkillId,
  SkillMastery,
  Unit,
  User,
  UserId,
} from "@learnly/shared";
import type { Container } from "../../src/container.js";
import { materializeCourse, type MaterializedCourse, type SeedCourse } from "../../src/db/seed/types.js";
import type { Clock } from "../../src/lib/clock.js";
import { conflict } from "../../src/lib/errors.js";
import type { PasswordHasher } from "../../src/lib/passwords.js";
import type { AttemptRepository, MasteryRepository, NewAttempt } from "../../src/modules/attempts/repository.js";
import type { NewRefreshToken, RefreshTokenRecord, RefreshTokenRepository } from "../../src/modules/auth/repository.js";
import type { CatalogRepository, LessonSummary } from "../../src/modules/catalog/repository.js";
import {
  DEFAULT_PREFERENCES,
  type NewUser,
  type Preferences,
  type ProfilePatch,
  type UserRepository,
  type UserWithSecret,
} from "../../src/modules/users/repository.js";

const clone = <T>(value: T): T => structuredClone(value);

/** Argon2 is deliberately slow; tests only need a hasher that round-trips. */
export const fastHasher: PasswordHasher = {
  hash: async (password) => `test$${password}`,
  verify: async (hash, password) => hash === `test$${password}`,
};

interface UserRow {
  user: User;
  passwordHash: string;
  preferences: Omit<Preferences, "locale">;
}

export class MemoryUsers implements UserRepository {
  readonly rows = new Map<UserId, UserRow>();

  constructor(private readonly clock: Clock) {}

  async create(input: NewUser): Promise<User> {
    const taken = [...this.rows.values()].some((row) => row.user.email.toLowerCase() === input.email.toLowerCase());
    if (taken) throw conflict("An account with this email already exists. Try signing in instead.");
    const user: User = {
      id: randomUUID() as UserId,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      gradeBand: input.gradeBand,
      avatarColor: input.avatarColor,
      locale: input.locale,
      createdAt: this.clock.now().toISOString(),
    };
    this.rows.set(user.id, { user, passwordHash: input.passwordHash, preferences: { ...DEFAULT_PREFERENCES } });
    return clone(user);
  }

  async findByEmail(email: string): Promise<UserWithSecret | null> {
    const row = [...this.rows.values()].find((r) => r.user.email.toLowerCase() === email.toLowerCase());
    return row ? { user: clone(row.user), passwordHash: row.passwordHash } : null;
  }

  async findById(id: UserId): Promise<User | null> {
    const row = this.rows.get(id);
    return row ? clone(row.user) : null;
  }

  async getPreferences(id: UserId): Promise<Preferences | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    const locale = row.user.locale === "es" || row.user.locale === "fil" ? row.user.locale : "en";
    return { ...row.preferences, locale };
  }

  async updateProfile(id: UserId, patch: ProfilePatch): Promise<Preferences | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    if (patch.displayName !== undefined) row.user.displayName = patch.displayName;
    if (patch.avatarColor !== undefined) row.user.avatarColor = patch.avatarColor;
    if (patch.locale !== undefined) row.user.locale = patch.locale;
    if (patch.dailyGoalMinutes !== undefined) row.preferences.dailyGoalMinutes = patch.dailyGoalMinutes;
    if (patch.reducedMotion !== undefined) row.preferences.reducedMotion = patch.reducedMotion;
    if (patch.soundEffects !== undefined) row.preferences.soundEffects = patch.soundEffects;
    return this.getPreferences(id);
  }

  /** Test helper: promote an account (admins can't sign up through the API). */
  setRole(id: UserId, role: Role): void {
    const row = this.rows.get(id);
    if (row) row.user.role = role;
  }
}

export class MemoryRefreshTokens implements RefreshTokenRepository {
  readonly rows = new Map<string, RefreshTokenRecord & { tokenHash: string }>();

  async insert(token: NewRefreshToken): Promise<RefreshTokenRecord> {
    const record = {
      id: randomUUID(),
      userId: token.userId,
      familyId: token.familyId,
      expiresAt: token.expiresAt,
      rotatedAt: null,
      revokedAt: null,
      tokenHash: token.tokenHash,
    };
    this.rows.set(record.id, record);
    return clone(record);
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = [...this.rows.values()].find((r) => r.tokenHash === tokenHash);
    return row ? clone(row) : null;
  }

  async markRotated(id: string, at: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.rotatedAt !== null || row.revokedAt !== null) return false;
    row.rotatedAt = at;
    return true;
  }

  async revokeFamily(familyId: string, _reason: string, at: string): Promise<number> {
    let revoked = 0;
    for (const row of this.rows.values()) {
      if (row.familyId === familyId && row.revokedAt === null) {
        row.revokedAt = at;
        revoked += 1;
      }
    }
    return revoked;
  }
}

/** The real seed content, materialised exactly as the seed script writes it. */
export class MemoryCatalog implements CatalogRepository {
  readonly courses = new Map<CourseId, MaterializedCourse["course"]>();
  readonly units: MaterializedCourse["units"] = [];
  readonly skills: MaterializedCourse["skills"] = [];
  readonly lessons = new Map<LessonId, MaterializedCourse["lessons"][number]>();
  readonly items = new Map<ItemId, Item>();

  static fromSeed(seeds: SeedCourse[]): MemoryCatalog {
    const catalog = new MemoryCatalog();
    for (const seed of seeds) {
      const content = materializeCourse(seed);
      catalog.courses.set(content.course.id, content.course);
      catalog.units.push(...content.units);
      catalog.skills.push(...content.skills);
      for (const lesson of content.lessons) catalog.lessons.set(lesson.id, lesson);
      for (const item of content.items) catalog.items.set(item.id, item);
    }
    return catalog;
  }

  private toCourse({ position: _position, ...course }: MaterializedCourse["course"]): Course {
    return clone(course);
  }

  private skillsOfCourse(courseId: CourseId): MaterializedCourse["skills"] {
    const unitOrder = new Map(
      this.units.filter((unit) => unit.courseId === courseId).map((unit) => [unit.id, unit.position]),
    );
    return this.skills
      .filter((skill) => unitOrder.has(skill.unitId))
      .sort((a, b) => (unitOrder.get(a.unitId) ?? 0) - (unitOrder.get(b.unitId) ?? 0) || a.position - b.position);
  }

  async listCourses(): Promise<Course[]> {
    return [...this.courses.values()].sort((a, b) => a.position - b.position).map((c) => this.toCourse(c));
  }

  async findCourseBySlug(slug: string): Promise<Course | null> {
    const course = [...this.courses.values()].find((c) => c.slug === slug);
    return course ? this.toCourse(course) : null;
  }

  async findCourseById(id: CourseId): Promise<Course | null> {
    const course = this.courses.get(id);
    return course ? this.toCourse(course) : null;
  }

  async listUnits(courseId: CourseId): Promise<Unit[]> {
    return this.units
      .filter((unit) => unit.courseId === courseId)
      .sort((a, b) => a.position - b.position)
      .map(({ position, ...unit }) => ({
        ...clone(unit),
        position,
        skills: this.skills
          .filter((skill) => skill.unitId === unit.id)
          .sort((a, b) => a.position - b.position)
          .map(({ position: _p, ...skill }): Skill => clone(skill)),
      }));
  }

  async findSkill(id: SkillId): Promise<Skill | null> {
    const skill = this.skills.find((s) => s.id === id);
    if (!skill) return null;
    const { position: _position, ...rest } = skill;
    return clone(rest);
  }

  async findLesson(id: LessonId): Promise<Lesson | null> {
    const lesson = this.lessons.get(id);
    if (!lesson) return null;
    const { position: _position, ...rest } = lesson;
    return clone(rest);
  }

  async listLessonsForSkill(skillId: SkillId): Promise<LessonSummary[]> {
    return [...this.lessons.values()]
      .filter((lesson) => lesson.skillId === skillId)
      .sort((a, b) => a.level - b.level || a.position - b.position)
      .map(({ id, slug, title, level, estimatedMinutes }) => ({ id, slug, title, level, estimatedMinutes }));
  }

  async findItem(id: ItemId): Promise<Item | null> {
    const item = this.items.get(id);
    return item ? clone(item) : null;
  }

  async findItems(ids: ItemId[]): Promise<Item[]> {
    return ids.flatMap((id) => {
      const item = this.items.get(id);
      return item ? [clone(item)] : [];
    });
  }

  async listCandidates(courseId: CourseId): Promise<Candidate[]> {
    const skills = this.skillsOfCourse(courseId);
    return skills.flatMap((skill) =>
      [...this.items.values()]
        .filter((item) => item.skillId === skill.id)
        .map((item) => ({ id: item.id, skillId: item.skillId, difficulty: item.difficulty })),
    );
  }

  /** Test helpers. */
  courseBySlug(slug: string): MaterializedCourse["course"] {
    const course = [...this.courses.values()].find((c) => c.slug === slug);
    if (!course) throw new Error(`No course ${slug} in the test catalog`);
    return course;
  }

  skillByCode(code: string): MaterializedCourse["skills"][number] {
    const skill = this.skills.find((s) => s.code === code);
    if (!skill) throw new Error(`No skill ${code} in the test catalog`);
    return skill;
  }

  itemsOfSkill(code: string): Item[] {
    const skill = this.skillByCode(code);
    return [...this.items.values()].filter((item) => item.skillId === skill.id);
  }
}

export interface StoredAttempt extends Attempt {
  clientAttemptId: string | null;
  abilityBefore: number;
  sequence: number;
}

export class MemoryAttempts implements AttemptRepository {
  readonly rows: StoredAttempt[] = [];

  private strip({ clientAttemptId: _c, abilityBefore: _a, sequence: _s, ...attempt }: StoredAttempt): Attempt {
    return clone(attempt);
  }

  async findByClientId(userId: UserId, clientAttemptId: string): Promise<Attempt | null> {
    const row = this.rows.find((r) => r.userId === userId && r.clientAttemptId === clientAttemptId);
    return row ? this.strip(row) : null;
  }

  async insert(attempt: NewAttempt): Promise<Attempt | null> {
    if (attempt.clientAttemptId && this.rows.some((r) => r.userId === attempt.userId && r.clientAttemptId === attempt.clientAttemptId)) {
      return null;
    }
    const row: StoredAttempt = {
      id: randomUUID() as AttemptId,
      userId: attempt.userId,
      itemId: attempt.itemId,
      skillId: attempt.skillId,
      sessionId: attempt.sessionId,
      response: clone(attempt.response),
      correct: attempt.correct,
      hintsUsed: attempt.hintsUsed,
      durationMs: attempt.durationMs,
      answeredAt: attempt.answeredAt,
      clientAttemptId: attempt.clientAttemptId,
      abilityBefore: attempt.abilityBefore,
      sequence: this.rows.length,
    };
    this.rows.push(row);
    return this.strip(row);
  }

  /** Chronological, ties broken by insertion order — like `order by answered_at, created_at`. */
  ordered(filter: (row: StoredAttempt) => boolean = () => true): StoredAttempt[] {
    return this.rows
      .filter(filter)
      .sort((a, b) => Date.parse(a.answeredAt) - Date.parse(b.answeredAt) || a.sequence - b.sequence);
  }
}

export class MemoryMastery implements MasteryRepository {
  readonly rows = new Map<string, { userId: UserId; mastery: SkillMastery; updatedAt: string }>();

  constructor(private readonly clock: Clock) {}

  async find(userId: UserId, skillId: SkillId): Promise<SkillMastery | null> {
    const row = this.rows.get(`${userId}:${skillId}`);
    return row ? clone(row.mastery) : null;
  }

  async listForUser(userId: UserId, skillIds?: SkillId[]): Promise<SkillMastery[]> {
    return [...this.rows.values()]
      .filter((row) => row.userId === userId && (!skillIds || skillIds.includes(row.mastery.skillId)))
      .map((row) => clone(row.mastery));
  }

  async upsert(userId: UserId, mastery: SkillMastery): Promise<void> {
    this.rows.set(`${userId}:${mastery.skillId}`, {
      userId,
      mastery: clone(mastery),
      updatedAt: this.clock.now().toISOString(),
    });
  }

  changedSince(userId: UserId, since: string | null): SkillMastery[] {
    return [...this.rows.values()]
      .filter((row) => row.userId === userId && (since === null || Date.parse(row.updatedAt) > Date.parse(since)))
      .map((row) => clone(row.mastery));
  }
}

export interface MemoryStore {
  clock: Clock;
  users: MemoryUsers;
  refreshTokens: MemoryRefreshTokens;
  catalog: MemoryCatalog;
  attempts: MemoryAttempts;
  mastery: MemoryMastery;
}

type Installer = (container: Container, store: MemoryStore) => void;
const installers: Installer[] = [];

/**
 * Swap every Postgres-backed repository for an in-memory one. Must run after the feature
 * modules registered their services and before anything is resolved.
 */
export function installMemoryRepositories(container: Container, clock: Clock, courses: SeedCourse[]): MemoryStore {
  const store = { clock, catalog: MemoryCatalog.fromSeed(courses) } as MemoryStore;
  for (const install of installers) install(container, store);
  return store;
}

installers.push((container, store) => {
  store.users = new MemoryUsers(store.clock);
  store.refreshTokens = new MemoryRefreshTokens();
  store.attempts = new MemoryAttempts();
  store.mastery = new MemoryMastery(store.clock);
  container
    .register("passwordHasher", () => fastHasher)
    .register("userRepository", () => store.users)
    .register("refreshTokenRepository", () => store.refreshTokens)
    .register("catalogRepository", () => store.catalog)
    .register("attemptRepository", () => store.attempts)
    .register("masteryRepository", () => store.mastery);
});

