import {
  DEFAULT_BKT,
  INITIAL_REVIEW,
  applyAttemptV2,
  dueForReview,
  initialMastery,
  paramsForItem,
  type BktParams,
} from "@learnly/adaptive-engine";
import type { Item, Skill, SkillId, SkillMastery, UserId } from "@learnly/shared";
import type { Clock } from "../../lib/clock.js";
import type { MasteryRepository } from "../attempts/repository.js";
import type { MasteryEvidence, MasteryModel } from "../attempts/service.js";
import { LeastRecentReviewPlanner, type ReviewPlanner } from "../sessions/service.js";
import type { BktParamsRepository, ReviewStateRepository } from "./repository.js";

/**
 * Fitted parameters change once a night, but are read on every attempt — cache them per
 * skill for a few minutes so the hot path stays at one mastery read and two writes.
 */
export class BktParamsCache {
  private readonly entries = new Map<SkillId, { params: BktParams; loadedAt: number }>();

  constructor(
    private readonly repository: BktParamsRepository,
    private readonly clock: Clock,
    private readonly ttlMs = 10 * 60_000,
  ) {}

  async forSkill(skillId: SkillId): Promise<BktParams> {
    const now = this.clock.now().getTime();
    const cached = this.entries.get(skillId);
    if (cached && now - cached.loadedAt < this.ttlMs) return cached.params;
    const params = (await this.repository.forSkill(skillId)) ?? DEFAULT_BKT;
    this.entries.set(skillId, { params, loadedAt: now });
    return params;
  }

  invalidate(): void {
    this.entries.clear();
  }
}

function latest(a: string | null, b: string): string {
  return a !== null && Date.parse(a) > Date.parse(b) ? a : b;
}

/**
 * Engine v2: BKT decides whether a skill is learned (robust to slips and lucky guesses,
 * with guess rates adjusted per item kind), Rasch ability still drives item difficulty,
 * and every answer reschedules the skill's next spaced-repetition review.
 */
export class BktMasteryModel implements MasteryModel {
  constructor(
    private readonly mastery: MasteryRepository,
    private readonly reviews: ReviewStateRepository,
    private readonly params: BktParamsCache,
  ) {}

  async current(userId: UserId, skillId: SkillId): Promise<SkillMastery> {
    return (await this.mastery.find(userId, skillId)) ?? initialMastery(skillId);
  }

  async record(userId: UserId, item: Item, evidence: MasteryEvidence): Promise<SkillMastery> {
    const [mastery, review, base] = await Promise.all([
      this.current(userId, item.skillId),
      this.reviews.get(userId, item.skillId),
      this.params.forSkill(item.skillId),
    ]);
    const params = paramsForItem(base, item.kind, item.kind === "multiple_choice" ? item.choices.length : undefined);
    const next = applyAttemptV2({ mastery, review: review ?? INITIAL_REVIEW }, { difficulty: item.difficulty, ...evidence }, params);
    const updated: SkillMastery = {
      ...next.mastery,
      lastPracticedAt: latest(mastery.lastPracticedAt, evidence.answeredAt),
    };
    await Promise.all([
      this.mastery.upsert(userId, updated),
      this.reviews.save(userId, item.skillId, next.review),
    ]);
    return updated;
  }
}

/**
 * Review what the scheduler says is due, most overdue first. Skills last practised
 * before engine v2 have no due date yet; until they do, fall back to least-recent.
 */
export class DueReviewPlanner implements ReviewPlanner {
  private readonly fallback = new LeastRecentReviewPlanner();

  constructor(private readonly limit = 4) {}

  dueSkills(skills: Skill[], mastery: Map<SkillId, SkillMastery>, now: Date): SkillId[] {
    const inCourse = skills.flatMap((skill) => {
      const m = mastery.get(skill.id);
      return m ? [m] : [];
    });
    const due = dueForReview(inCourse, now, this.limit).map((m) => m.skillId);
    if (due.length > 0) return due;
    const scheduled = inCourse.some((m) => m.dueAt !== null);
    return scheduled ? [] : this.fallback.dueSkills(skills, mastery);
  }
}
