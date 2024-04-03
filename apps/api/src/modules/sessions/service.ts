import {
  DIAGNOSTIC_LIMITS,
  REASON_COPY,
  adaptiveTarget,
  nextDiagnosticItem,
  recommendedStartSkill,
  recordDiagnosticAnswer,
  selectNextItem,
  startDiagnostic,
  summarizeDiagnostic,
  type Candidate,
  type DiagnosticState,
} from "@learnly/adaptive-engine";
import {
  XP_RULES,
  type AttemptInput,
  type CourseId,
  type DiagnosticSummary,
  type ItemId,
  type NextItemResponse,
  type Session,
  type SessionId,
  type Skill,
  type SkillId,
  type SkillMastery,
  type StartSessionInput,
  type UserId,
} from "@learnly/shared";
import type { TransactionRunner } from "../../db/sql.js";
import type { Clock } from "../../lib/clock.js";
import { conflict, notFound } from "../../lib/errors.js";
import type { AttemptRepository, MasteryRepository } from "../attempts/repository.js";
import type { AttemptSubmitter, SubmissionOutcome } from "../attempts/service.js";
import type { CatalogRepository } from "../catalog/repository.js";
import { toPublicItem } from "../catalog/service.js";
import type { ProgressService } from "../progress/service.js";
import type { SessionAnswer, SessionRecord, SessionRepository } from "./repository.js";

export const SESSION_TARGETS = { practice: 10, review: 6 } as const;

/** Review items should feel comfortable: the point is retrieval, not challenge. */
const REVIEW_TARGET_SUCCESS = 0.85;
const DIAGNOSTIC_SKILLS = 6;

/** Which skills a review session should revisit, most urgent first. */
export interface ReviewPlanner {
  dueSkills(skills: Skill[], mastery: Map<SkillId, SkillMastery>, now: Date): SkillId[];
}

/** Until spaced repetition lands: revisit practised skills that were touched longest ago. */
export class LeastRecentReviewPlanner implements ReviewPlanner {
  constructor(private readonly limit = 4) {}

  dueSkills(skills: Skill[], mastery: Map<SkillId, SkillMastery>): SkillId[] {
    return skills
      .flatMap((skill) => {
        const m = mastery.get(skill.id);
        return m && m.attempts > 0 && m.lastPracticedAt !== null ? [m] : [];
      })
      .sort((a, b) => Date.parse(a.lastPracticedAt ?? "") - Date.parse(b.lastPracticedAt ?? ""))
      .slice(0, this.limit)
      .map((m) => m.skillId);
  }
}

function isComfortable(mastery: SkillMastery | undefined): boolean {
  return mastery !== undefined && (mastery.band === "practicing" || mastery.band === "mastered" || mastery.pKnown >= 0.6);
}

/** Skills whose prerequisites the learner is comfortable with, in curriculum order. */
export function unlockedSkills(skills: Skill[], mastery: Map<SkillId, SkillMastery>): Skill[] {
  return skills.filter((skill) => skill.prerequisiteIds.every((id) => isComfortable(mastery.get(id))));
}

/** The first unlocked skill that isn't mastered yet — "where the learner is". */
export function focusSkill(skills: Skill[], mastery: Map<SkillId, SkillMastery>): Skill | null {
  return unlockedSkills(skills, mastery).find((skill) => mastery.get(skill.id)?.band !== "mastered") ?? null;
}

/**
 * Practice draws from a small window of skills: the next few not yet mastered (so new
 * learning stays focused) plus mastered ones the selector can interleave for retention.
 */
export function practicePool(skills: Skill[], mastery: Map<SkillId, SkillMastery>): Set<SkillId> {
  const unlocked = unlockedSkills(skills, mastery);
  const learning = unlocked.filter((skill) => mastery.get(skill.id)?.band !== "mastered").slice(0, 3);
  const mastered = unlocked.filter((skill) => mastery.get(skill.id)?.band === "mastered");
  const pool = [...learning, ...mastered];
  return new Set((pool.length > 0 ? pool : skills.slice(0, 1)).map((skill) => skill.id));
}

/** A light diagnostic probes a spread of skills across the course, not just the first unit. */
export function pickDiagnosticSkills(skills: Skill[], max = DIAGNOSTIC_SKILLS): Skill[] {
  if (skills.length <= max) return skills;
  const step = (skills.length - 1) / (max - 1);
  const picked = Array.from({ length: max }, (_, index) => skills[Math.round(index * step)]);
  return [...new Set(picked.filter((skill): skill is Skill => skill !== undefined))];
}

export function toSession(record: SessionRecord): Session {
  const { id, userId, courseId, kind, startedAt, completedAt, itemsAnswered, itemsCorrect } = record;
  return { id, userId, courseId, kind, startedAt, completedAt, itemsAnswered, itemsCorrect };
}

interface Plan {
  itemId: ItemId | null;
  rationale: string;
  target: number;
}

export interface SessionCompletion {
  session: Session;
  xpEarned: number;
  summary?: DiagnosticSummary;
}

export interface SessionServiceDeps {
  sessions: SessionRepository;
  catalog: CatalogRepository;
  mastery: MasteryRepository;
  progress: ProgressService;
  reviewPlanner: ReviewPlanner;
  clock: Clock;
  random?: () => number;
}

export class SessionService {
  constructor(private readonly deps: SessionServiceDeps) {}

  async start(userId: UserId, input: StartSessionInput): Promise<NextItemResponse> {
    const courseId = input.courseId as CourseId;
    const course = await this.deps.catalog.findCourseById(courseId);
    if (!course) throw notFound("course");
    const targetItems =
      input.kind === "diagnostic" ? DIAGNOSTIC_LIMITS.maxTotal : (input.targetItems ?? SESSION_TARGETS[input.kind]);
    const session = await this.deps.sessions.create({
      userId,
      courseId,
      kind: input.kind,
      targetItems,
      startedAt: this.deps.clock.now().toISOString(),
    });
    return this.respond(session);
  }

  async next(userId: UserId, sessionId: SessionId): Promise<NextItemResponse> {
    return this.respond(await this.owned(userId, sessionId));
  }

  async complete(userId: UserId, sessionId: SessionId): Promise<SessionCompletion> {
    const session = await this.owned(userId, sessionId);
    let completed = session;
    if (session.completedAt === null) {
      const summary = session.kind === "diagnostic" ? await this.diagnosticSummary(session) : null;
      completed = await this.deps.sessions.complete(sessionId, this.deps.clock.now().toISOString(), summary);
    }
    if (completed.kind === "diagnostic" && completed.itemsAnswered > 0) {
      await this.deps.progress.award(userId, XP_RULES.diagnosticComplete, "diagnostic_complete", sessionId, sessionId);
    }
    const xpEarned = await this.deps.progress.xpForSession(userId, sessionId);
    return {
      session: toSession(completed),
      xpEarned,
      ...(completed.summary ? { summary: completed.summary } : {}),
    };
  }

  /** Sessions belong to one learner; anyone else gets a 404, not a hint that it exists. */
  async owned(userId: UserId, sessionId: SessionId): Promise<SessionRecord> {
    const session = await this.deps.sessions.find(sessionId);
    if (!session || session.userId !== userId) throw notFound("session");
    return session;
  }

  private async respond(session: SessionRecord): Promise<NextItemResponse> {
    const answers = await this.deps.sessions.answers(session.id);
    const plan =
      session.completedAt !== null
        ? { itemId: null, rationale: "This session is complete. Nice work!", target: session.targetItems }
        : await this.plan(session, answers);
    const item = plan.itemId ? await this.deps.catalog.findItem(plan.itemId) : null;
    return {
      session: toSession(session),
      item: item ? toPublicItem(item) : null,
      rationale: plan.rationale,
      progress: { answered: answers.length, target: Math.max(plan.target, answers.length) },
    };
  }

  private async courseSkills(courseId: CourseId): Promise<Skill[]> {
    return (await this.deps.catalog.listUnits(courseId)).flatMap((unit) => unit.skills);
  }

  private async plan(session: SessionRecord, answers: SessionAnswer[]): Promise<Plan> {
    if (session.kind === "diagnostic") return this.planDiagnostic(session, answers);

    if (answers.length >= session.targetItems) {
      return { itemId: null, rationale: "That's the whole set — great focus!", target: session.targetItems };
    }
    const skills = await this.courseSkills(session.courseId);
    const masteryList = await this.deps.mastery.listForUser(session.userId, skills.map((skill) => skill.id));
    const mastery = new Map(masteryList.map((m) => [m.skillId, m]));
    const candidates = await this.deps.catalog.listCandidates(session.courseId);

    let pool: Set<SkillId>;
    let targetSuccess: number;
    if (session.kind === "review") {
      pool = new Set(this.deps.reviewPlanner.dueSkills(skills, mastery, this.deps.clock.now()));
      if (pool.size === 0) {
        return { itemId: null, rationale: "Nothing needs reviewing right now — you're all caught up!", target: answers.length };
      }
      targetSuccess = REVIEW_TARGET_SUCCESS;
    } else {
      pool = practicePool(skills, mastery);
      targetSuccess = adaptiveTarget(answers.map((answer) => answer.correct));
    }

    const selection = selectNextItem(
      candidates.filter((candidate) => pool.has(candidate.skillId)),
      mastery,
      {
        targetSuccess,
        recentItemIds: answers.map((answer) => answer.itemId),
        recentSkillIds: answers.slice(-3).map((answer) => answer.skillId),
        ...(this.deps.random ? { random: this.deps.random } : {}),
      },
    );
    if (!selection) {
      return { itemId: null, rationale: "You've worked through every question here for now!", target: answers.length };
    }
    const rationale = session.kind === "review" ? REASON_COPY.review : REASON_COPY[selection.reason];
    return { itemId: selection.item.id, rationale, target: session.targetItems };
  }

  /** Rebuild the diagnostic state from the answers so far (the session itself is stateless). */
  private async diagnosticState(session: SessionRecord, answers: SessionAnswer[]) {
    const skills = pickDiagnosticSkills(await this.courseSkills(session.courseId));
    const skillIds = new Set(skills.map((skill) => skill.id));
    const candidates = (await this.deps.catalog.listCandidates(session.courseId)).filter((c) => skillIds.has(c.skillId));
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    let state: DiagnosticState = startDiagnostic(skills.map((skill) => skill.id));
    for (const answer of answers) {
      const candidate: Candidate = byId.get(answer.itemId) ?? { id: answer.itemId, skillId: answer.skillId, difficulty: 0 };
      state = recordDiagnosticAnswer(state, candidate, answer.correct, answer.answeredAt);
    }
    return { state, skills, candidates };
  }

  private async planDiagnostic(session: SessionRecord, answers: SessionAnswer[]): Promise<Plan> {
    const { state, skills, candidates } = await this.diagnosticState(session, answers);
    const next = nextDiagnosticItem(state, candidates);
    // Most skills settle after two answers; show that as the target so the bar moves honestly.
    const target = Math.min(DIAGNOSTIC_LIMITS.maxTotal, skills.length * 2);
    if (!next) {
      return { itemId: null, rationale: "All done! We found your starting point.", target: answers.length };
    }
    return {
      itemId: next.id,
      rationale: "A quick check to find your starting point — there's no pressure to get these right.",
      target: Math.max(target, answers.length + 1),
    };
  }

  private async diagnosticSummary(session: SessionRecord): Promise<DiagnosticSummary> {
    const answers = await this.deps.sessions.answers(session.id);
    const { state, skills } = await this.diagnosticState(session, answers);
    const names = new Map(skills.map((skill) => [skill.id, skill.name]));
    const points = summarizeDiagnostic(state);
    const startSkill = recommendedStartSkill(points);
    const lessons = startSkill ? await this.deps.catalog.listLessonsForSkill(startSkill) : [];
    return {
      sessionId: session.id,
      startingPoints: points.map((point) => ({ ...point, skillName: names.get(point.skillId) ?? "" })),
      recommendedLessonId: lessons[0]?.id ?? null,
    };
  }
}

/**
 * Attempts that belong to a session must be for an open session the learner owns; once
 * scored, they move the session's counters. Runs before the base pipeline records anything.
 */
export class SessionAwareSubmitter implements AttemptSubmitter {
  constructor(
    private readonly inner: AttemptSubmitter,
    private readonly sessions: SessionRepository,
    private readonly attempts: AttemptRepository,
    private readonly transactions: TransactionRunner,
  ) {}

  submit(userId: UserId, input: AttemptInput): Promise<SubmissionOutcome> {
    if (!input.sessionId) return this.inner.submit(userId, input);
    const sessionId = input.sessionId as SessionId;
    return this.transactions.transaction(async () => {
      const session = await this.sessions.find(sessionId);
      if (!session || session.userId !== userId) throw notFound("session");
      if (session.completedAt !== null) {
        // A retry of an answer given before the session ended is still welcome.
        const original = input.clientAttemptId
          ? await this.attempts.findByClientId(userId, input.clientAttemptId)
          : null;
        if (!original) throw conflict("This session has already finished. Start a new one to keep going!");
        return this.inner.submit(userId, input);
      }
      const outcome = await this.inner.submit(userId, input);
      if (!outcome.replayed) await this.sessions.recordAnswer(sessionId, outcome.body.correct);
      return outcome;
    });
  }
}
