import { probabilityCorrect, recommendPace, type PaceSignal } from "@learnly/adaptive-engine";
import {
  XP_RULES,
  advanceStreak,
  levelForXp,
  streakBonus,
  xpForAttempt,
  type AttemptInput,
  type AttemptResult,
  type Course,
  type EncouragementKey,
  type LessonId,
  type LevelInfo,
  type SessionId,
  type SkillId,
  type SkillMastery,
  type StreakState,
  type UserId,
} from "@learnly/shared";
import type { TransactionRunner } from "../../db/sql.js";
import type { Clock } from "../../lib/clock.js";
import { dayRange, daysBetween, utcDay } from "../../lib/dates.js";
import { notFound } from "../../lib/errors.js";
import type { MasteryRepository } from "../attempts/repository.js";
import { resolveAnsweredAt, type AttemptSubmitter, type SubmissionOutcome } from "../attempts/service.js";
import type { CatalogRepository, LessonSummary } from "../catalog/repository.js";
import type { SessionRepository } from "../sessions/repository.js";
import { focusSkill } from "../sessions/service.js";
import type { UserRepository } from "../users/repository.js";
import type { ActivityDay, ActivityDelta, ProgressRepository, XpReason } from "./repository.js";

export interface ProgressSummary {
  totalXp: number;
  level: LevelInfo;
  streak: StreakState;
  minutesToday: number;
  dailyGoalMinutes: number;
}

export interface ProgressOverview extends ProgressSummary {
  mastery: SkillMastery[];
  recentActivity: ActivityDay[];
}

export interface Recommendation {
  type: "lesson" | "practice" | "review" | "diagnostic";
  title: string;
  subtitle: string;
  lessonId?: LessonId;
  courseSlug: string;
  estimatedMinutes: number;
}

/** A practised skill comes back for review after this many quiet days. */
const REVIEW_AFTER_DAYS = 4;

/**
 * The streak to *show*: a streak that has already lapsed (and can't be saved by a
 * freeze) displays as 0 even before the learner's next activity resets it.
 */
export function displayedStreak(streak: StreakState, today: string): StreakState {
  if (streak.lastActiveDay === null) return streak;
  const gap = daysBetween(streak.lastActiveDay, today);
  if (gap <= 1 || (gap === 2 && streak.freezesAvailable > 0)) return streak;
  return { ...streak, current: 0 };
}

export interface ProgressServiceDeps {
  progress: ProgressRepository;
  users: UserRepository;
  catalog: CatalogRepository;
  mastery: MasteryRepository;
  sessions: SessionRepository;
  transactions: TransactionRunner;
  clock: Clock;
}

export class ProgressService {
  constructor(private readonly deps: ProgressServiceDeps) {}

  async summary(userId: UserId, dailyGoalMinutes?: number): Promise<ProgressSummary> {
    const today = utcDay(this.deps.clock.now());
    const [record, activity, goal] = await Promise.all([
      this.deps.progress.get(userId),
      this.deps.progress.activityBetween(userId, today, today),
      dailyGoalMinutes ?? this.deps.users.getPreferences(userId).then((p) => p?.dailyGoalMinutes ?? 15),
    ]);
    return {
      totalXp: record.totalXp,
      level: levelForXp(record.totalXp),
      streak: displayedStreak(record.streak, today),
      minutesToday: activity[0]?.minutes ?? 0,
      dailyGoalMinutes: goal,
    };
  }

  award(userId: UserId, amount: number, reason: XpReason, sourceId: string, sessionId: SessionId | null = null) {
    return this.deps.progress.addXp(userId, { amount, reason, sourceId, sessionId });
  }

  xpFor(userId: UserId, reason: XpReason, sourceId: string): Promise<number> {
    return this.deps.progress.xpFor(userId, reason, sourceId);
  }

  xpForSession(userId: UserId, sessionId: SessionId): Promise<number> {
    return this.deps.progress.xpForSession(userId, sessionId);
  }

  /**
   * Log time and results for the day of `at`, advance the streak, and grant the daily
   * streak bonus the first time a learner shows up on a new day.
   */
  async recordActivity(userId: UserId, at: string, delta: ActivityDelta): Promise<{ streak: StreakState; bonus: number }> {
    const day = utcDay(at);
    await this.deps.progress.addActivity(userId, day, delta);
    const { streak } = await this.deps.progress.get(userId);
    // An offline answer from an earlier day counts as time spent but can't rewrite the streak.
    if (streak.lastActiveDay !== null && day <= streak.lastActiveDay) return { streak, bonus: 0 };
    const next = advanceStreak(streak, day);
    await this.deps.progress.saveStreak(userId, next);
    const bonus = next.current > 1 ? await this.award(userId, streakBonus(next.current), "streak_bonus", day) : 0;
    return { streak: next, bonus };
  }

  async completeLesson(
    userId: UserId,
    lessonId: LessonId,
    durationMs: number,
    claimedAt?: string,
  ): Promise<{ xpEarned: number; progress: ProgressSummary }> {
    const lesson = await this.deps.catalog.findLesson(lessonId);
    if (!lesson) throw notFound("lesson");
    const at = resolveAnsweredAt(claimedAt, this.deps.clock.now());
    const xpEarned = await this.deps.transactions.transaction(async () => {
      await this.deps.progress.recordLessonCompletion(userId, lessonId, durationMs, at);
      // Lesson XP is granted on the first completion; re-reading is encouraged but not farmed.
      const lessonXp = await this.award(userId, XP_RULES.lessonComplete, "lesson_complete", lessonId);
      const { bonus } = await this.recordActivity(userId, at, {
        seconds: durationMs / 1000,
        answered: 0,
        correct: 0,
        lessons: 1,
      });
      return lessonXp + bonus;
    });
    return { xpEarned, progress: await this.summary(userId) };
  }

  async overview(userId: UserId): Promise<ProgressOverview> {
    const today = utcDay(this.deps.clock.now());
    const days = dayRange(today, 7);
    const [summary, mastery, activity] = await Promise.all([
      this.summary(userId),
      this.deps.mastery.listForUser(userId),
      this.deps.progress.activityBetween(userId, days[0] ?? today, today),
    ]);
    const byDay = new Map(activity.map((entry) => [entry.day, entry]));
    return {
      ...summary,
      mastery,
      recentActivity: days.map((day) => byDay.get(day) ?? { day, minutes: 0, itemsCorrect: 0 }),
    };
  }

  async courseMastery(userId: UserId, slug: string): Promise<SkillMastery[]> {
    const course = await this.deps.catalog.findCourseBySlug(slug);
    if (!course) throw notFound("course");
    const skills = (await this.deps.catalog.listUnits(course.id)).flatMap((unit) => unit.skills);
    const stored = new Map(
      (await this.deps.mastery.listForUser(userId, skills.map((skill) => skill.id))).map((m) => [m.skillId, m]),
    );
    return skills.map((skill) => stored.get(skill.id) ?? untouchedMastery(skill.id));
  }

  /**
   * What to do next, across every course: continue where the learner is (a lesson at
   * the right level, then practice), refresh skills going stale, or — for a course not
   * started yet — take the light diagnostic.
   */
  async recommendations(userId: UserId): Promise<Recommendation[]> {
    const now = this.deps.clock.now();
    const [user, courses, mastery, completed, recent] = await Promise.all([
      this.deps.users.findById(userId),
      this.deps.catalog.listCourses(),
      this.deps.mastery.listForUser(userId),
      this.deps.progress.completedLessonIds(userId),
      this.deps.progress.recentResults(userId, 6),
    ]);
    const masteryBySkill = new Map(mastery.map((m) => [m.skillId, m]));
    const completedLessons = new Set(completed);
    const signals: PaceSignal[] = recent.reverse().map(({ correct, durationMs, hintsUsed }) => ({ correct, durationMs, hintsUsed }));
    const pace = recommendPace(signals);

    const next: Recommendation[] = [];
    const notStarted: Course[] = [];
    for (const course of courses) {
      const skills = (await this.deps.catalog.listUnits(course.id)).flatMap((unit) => unit.skills);
      const started = skills.some((skill) => (masteryBySkill.get(skill.id)?.attempts ?? 0) > 0);
      const diagnosed = await this.deps.sessions.hasCompleted(userId, course.id, "diagnostic");
      if (!started && !diagnosed) {
        notStarted.push(course);
        continue;
      }

      const focus = focusSkill(skills, masteryBySkill);
      if (focus) {
        const lessons = await this.deps.catalog.listLessonsForSkill(focus.id);
        const lesson = pickLesson(lessons, completedLessons, targetLevel(masteryBySkill.get(focus.id), pace.levelDelta));
        if (lesson) {
          next.push({
            type: "lesson",
            title: lesson.title,
            subtitle: `${course.title} · ${focus.name}`,
            lessonId: lesson.id,
            courseSlug: course.slug,
            estimatedMinutes: lesson.estimatedMinutes,
          });
        }
        next.push({
          type: "practice",
          title: `Practice: ${focus.name}`,
          subtitle: pace.decision === "slow_down" ? "Gentle practice with worked examples" : "Questions picked just for you",
          courseSlug: course.slug,
          estimatedMinutes: 8,
        });
      }

      const stale = skills.filter((skill) => {
        const m = masteryBySkill.get(skill.id);
        if (!m || m.lastPracticedAt === null || (m.band !== "practicing" && m.band !== "mastered")) return false;
        return now.getTime() - Date.parse(m.lastPracticedAt) > REVIEW_AFTER_DAYS * 86_400_000;
      });
      if (stale.length > 0) {
        next.push({
          type: "review",
          title: "Quick review",
          subtitle: `${stale.length} ${stale.length === 1 ? "skill" : "skills"} in ${course.title} could use a refresh`,
          courseSlug: course.slug,
          estimatedMinutes: 5,
        });
      }
    }

    const firstCourse = notStarted.find((course) => course.gradeBand === user?.gradeBand) ?? notStarted[0];
    if (firstCourse && next.length < 4) {
      next.push({
        type: "diagnostic",
        title: `Find your starting point in ${firstCourse.title}`,
        subtitle: "A quick, no-pressure warm-up so we can skip what you already know.",
        courseSlug: firstCourse.slug,
        estimatedMinutes: 5,
      });
    }
    return next.slice(0, 4);
  }
}

function untouchedMastery(skillId: SkillId): SkillMastery {
  return { skillId, pKnown: 0, ability: 0, band: "new", attempts: 0, lastPracticedAt: null, dueAt: null };
}

/** Start gently on a new skill, step up once the learner is practising it, adjusted by pace. */
export function targetLevel(mastery: SkillMastery | undefined, paceDelta: -1 | 0 | 1): number {
  const base = !mastery || mastery.band === "new" || mastery.band === "learning" ? 1 : 2;
  return Math.min(5, Math.max(1, base + paceDelta));
}

export function pickLesson(lessons: LessonSummary[], completed: Set<LessonId>, level: number): LessonSummary | null {
  const open = lessons.filter((lesson) => !completed.has(lesson.id));
  if (open.length === 0) return null;
  return open.reduce((best, lesson) => (Math.abs(lesson.level - level) < Math.abs(best.level - level) ? lesson : best));
}

export interface EncouragementSignals {
  correct: boolean;
  close: boolean;
  hintsUsed: number;
  /** Probability the learner would get it right, before answering. */
  expectedSuccess: number;
  /** Current run of correct answers, including this one. */
  consecutiveCorrect: number;
  /** Current run of misses, including this one. */
  consecutiveMisses: number;
  masteredNow: boolean;
  leveledUp: boolean;
}

/** Celebrate the most meaningful thing that just happened; never say "wrong". */
export function chooseEncouragement(signals: EncouragementSignals): EncouragementKey {
  if (signals.correct) {
    if (signals.masteredNow) return "mastered";
    if (signals.leveledUp) return "level_up";
    if (signals.consecutiveCorrect >= 3) return "correct_streak";
    if (signals.expectedSuccess < 0.45) return "correct_hard";
    if (signals.hintsUsed > 0) return "correct_after_hint";
    return "correct";
  }
  if (signals.close) return "incorrect_close";
  return signals.consecutiveMisses >= 2 ? "incorrect_again" : "incorrect_first";
}

function leadingRun(results: { correct: boolean }[], correct: boolean): number {
  let run = 0;
  for (const result of results) {
    if (result.correct !== correct) break;
    run += 1;
  }
  return run;
}

/**
 * Wraps the attempt pipeline to turn a scored attempt into a full `AttemptResult`:
 * XP (first-try bonus, hint penalty), the daily streak, and an encouragement key.
 */
export class RewardingAttemptSubmitter implements AttemptSubmitter {
  constructor(
    private readonly inner: AttemptSubmitter,
    private readonly progress: ProgressService,
    private readonly repository: ProgressRepository,
    private readonly transactions: TransactionRunner,
  ) {}

  submit(userId: UserId, input: AttemptInput): Promise<SubmissionOutcome> {
    return this.transactions.transaction(async () => {
      const outcome = await this.inner.submit(userId, input);
      const { body, item } = outcome;

      if (outcome.replayed) {
        const result: AttemptResult = {
          ...body,
          xpEarned: await this.progress.xpFor(userId, "attempt", body.attempt.id),
          encouragementKey: body.correct ? "correct" : "incorrect_first",
        };
        return { ...outcome, body: result };
      }

      const before = await this.repository.get(userId);
      const attemptsOnItem = await this.repository.countItemAttempts(userId, item.id);
      const attemptXp = await this.progress.award(
        userId,
        xpForAttempt(body.correct, body.attempt.hintsUsed, attemptsOnItem <= 1),
        "attempt",
        body.attempt.id,
        body.attempt.sessionId,
      );
      const { bonus } = await this.progress.recordActivity(userId, body.attempt.answeredAt, {
        seconds: body.attempt.durationMs / 1000,
        answered: 1,
        correct: body.correct ? 1 : 0,
        lessons: 0,
      });
      const xpEarned = attemptXp + bonus;
      const recent = await this.repository.recentResults(userId, 6);

      const result: AttemptResult = {
        ...body,
        xpEarned,
        encouragementKey: chooseEncouragement({
          correct: body.correct,
          close: outcome.close,
          hintsUsed: body.attempt.hintsUsed,
          expectedSuccess: probabilityCorrect(outcome.previousMastery.ability, item.difficulty),
          consecutiveCorrect: leadingRun(recent, true),
          consecutiveMisses: leadingRun(recent, false),
          masteredNow: outcome.previousMastery.band !== "mastered" && body.mastery.band === "mastered",
          leveledUp: levelForXp(before.totalXp + xpEarned).level > levelForXp(before.totalXp).level,
        }),
      };
      return { ...outcome, body: result };
    });
  }
}
