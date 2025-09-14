import { looksLikeRapidGuessing } from "@learnly/adaptive-engine";
import type {
  Item,
  ItemId,
  MasteryBand,
  Response,
  SkillHotspot,
  SkillId,
  SkillMastery,
  StudentSnapshot,
  UserId,
} from "@learnly/shared";
import { normalizeText } from "../../lib/scoring.js";

/** An attempt as the insights pipeline sees it. Chronological order is assumed. */
export interface InsightAttempt {
  userId: UserId;
  itemId: ItemId;
  skillId: SkillId;
  correct: boolean;
  response: Response;
  hintsUsed: number;
  durationMs: number;
  answeredAt: string;
}

export interface SkillInfo {
  id: SkillId;
  name: string;
  unitTitle: string;
}

export const HOTSPOT_RULES = {
  /** Below this many attempts an error rate is noise, not a signal. */
  minAttempts: 5,
  /** A student is "struggling" on a skill with at least this many tries… */
  strugglingMinAttempts: 3,
  /** …and at least this share of them wrong. */
  strugglingErrorRate: 0.5,
  /** A wrong answer is a misconception only if it accounts for this share of misses. */
  misconceptionShare: 0.3,
  misconceptionMinCount: 2,
  limit: 8,
} as const;

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

/** Human-readable version of an answer, for educators. */
export function describeResponse(item: Item | undefined, response: Response): string {
  switch (response.kind) {
    case "multiple_choice": {
      const choice = item?.kind === "multiple_choice" ? item.choices.find((c) => c.id === response.choiceId) : undefined;
      return choice?.text ?? response.choiceId;
    }
    case "numeric": {
      const unit = item?.kind === "numeric" && item.unit ? ` ${item.unit}` : "";
      return `${response.value}${unit}`;
    }
    case "short_text":
      return normalizeText(response.text);
    case "ordering": {
      const entries = item?.kind === "ordering" ? new Map(item.entries.map((e) => [e.id, e.text])) : new Map<string, string>();
      return response.order.map((id) => entries.get(id) ?? id).join(" → ");
    }
  }
}

/**
 * The most common wrong answer for a skill — but only if it clearly dominates. Random
 * slips scatter; a misconception (1/4 + 1/4 = 2/8) shows up again and again.
 */
export function commonMisconception(wrong: InsightAttempt[], items: Map<ItemId, Item>): string | null {
  if (wrong.length === 0) return null;
  const groups = new Map<string, { count: number; itemId: ItemId; answer: string }>();
  for (const attempt of wrong) {
    const answer = describeResponse(items.get(attempt.itemId), attempt.response);
    const key = `${attempt.itemId}\u0000${answer}`;
    const group = groups.get(key) ?? { count: 0, itemId: attempt.itemId, answer };
    group.count += 1;
    groups.set(key, group);
  }
  const top = [...groups.values()].sort((a, b) => b.count - a.count)[0];
  if (!top || top.count < HOTSPOT_RULES.misconceptionMinCount || top.count / wrong.length < HOTSPOT_RULES.misconceptionShare) {
    return null;
  }
  const prompt = items.get(top.itemId)?.prompt;
  return prompt ? `“${truncate(top.answer, 40)}” for “${truncate(prompt, 70)}”` : `“${truncate(top.answer, 40)}”`;
}

export function skillHotspots(attempts: InsightAttempt[], skills: SkillInfo[], items: Map<ItemId, Item>): SkillHotspot[] {
  const bySkill = new Map<SkillId, InsightAttempt[]>();
  for (const attempt of attempts) {
    const list = bySkill.get(attempt.skillId) ?? [];
    list.push(attempt);
    bySkill.set(attempt.skillId, list);
  }

  const hotspots: SkillHotspot[] = [];
  for (const skill of skills) {
    const list = bySkill.get(skill.id) ?? [];
    if (list.length < HOTSPOT_RULES.minAttempts) continue;
    const wrong = list.filter((attempt) => !attempt.correct);
    const perStudent = new Map<UserId, { total: number; wrong: number }>();
    for (const attempt of list) {
      const tally = perStudent.get(attempt.userId) ?? { total: 0, wrong: 0 };
      tally.total += 1;
      if (!attempt.correct) tally.wrong += 1;
      perStudent.set(attempt.userId, tally);
    }
    const studentsStruggling = [...perStudent.values()].filter(
      (t) => t.total >= HOTSPOT_RULES.strugglingMinAttempts && t.wrong / t.total >= HOTSPOT_RULES.strugglingErrorRate,
    ).length;
    hotspots.push({
      skillId: skill.id,
      skillName: skill.name,
      unitTitle: skill.unitTitle,
      errorRate: wrong.length / list.length,
      studentsStruggling,
      commonMisconception: commonMisconception(wrong, items),
    });
  }
  return hotspots
    .sort((a, b) => b.errorRate - a.errorRate || b.studentsStruggling - a.studentsStruggling)
    .slice(0, HOTSPOT_RULES.limit);
}

export const ATTENTION_RULES = {
  inactiveDays: 5,
  lowAccuracy: 0.5,
  lowAccuracyMinAttempts: 8,
  stuckSkills: 2,
  stuckMinAttempts: 6,
} as const;

export type AttentionReason = "inactive" | "low_accuracy" | "rapid_guessing" | "stuck";

export interface AttentionInput {
  /** This student's attempts in the window, oldest first. */
  attempts: InsightAttempt[];
  lastActiveAt: string | null;
  mastery: SkillMastery[];
  now: Date;
}

/**
 * Deliberately simple and explainable, so an educator can trust (and argue with) it:
 * gone quiet, mostly missing, rushing through, or stuck on several skills at once.
 */
export function attentionReasons({ attempts, lastActiveAt, mastery, now }: AttentionInput): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  const quietMs = lastActiveAt === null ? Number.POSITIVE_INFINITY : now.getTime() - Date.parse(lastActiveAt);
  if (quietMs > ATTENTION_RULES.inactiveDays * 86_400_000) reasons.push("inactive");

  const correct = attempts.filter((attempt) => attempt.correct).length;
  if (attempts.length >= ATTENTION_RULES.lowAccuracyMinAttempts && correct / attempts.length < ATTENTION_RULES.lowAccuracy) {
    reasons.push("low_accuracy");
  }
  if (looksLikeRapidGuessing(attempts.map(({ correct: c, durationMs, hintsUsed }) => ({ correct: c, durationMs, hintsUsed })))) {
    reasons.push("rapid_guessing");
  }
  const stuck = mastery.filter((m) => m.band === "learning" && m.attempts >= ATTENTION_RULES.stuckMinAttempts).length;
  if (stuck >= ATTENTION_RULES.stuckSkills) reasons.push("stuck");
  return reasons;
}

export interface SnapshotInput {
  userId: UserId;
  displayName: string;
  avatarColor: string;
  minutesThisWeek: number;
  streak: number;
  lastActiveAt: string | null;
  attempts: InsightAttempt[];
  mastery: SkillMastery[];
  now: Date;
}

export function studentSnapshot(input: SnapshotInput): StudentSnapshot {
  return {
    userId: input.userId,
    displayName: input.displayName,
    avatarColor: input.avatarColor,
    minutesThisWeek: input.minutesThisWeek,
    streak: input.streak,
    masteredSkills: input.mastery.filter((m) => m.band === "mastered").length,
    needsAttention: attentionReasons(input).length > 0,
    lastActiveAt: input.lastActiveAt,
  };
}

/** Bands across every student × course skill; skills never touched count as "new". */
export function masteryDistribution(studentCount: number, skillCount: number, mastery: SkillMastery[]): Record<MasteryBand, number> {
  const distribution: Record<MasteryBand, number> = { new: 0, learning: 0, practicing: 0, mastered: 0 };
  for (const m of mastery) distribution[m.band] += 1;
  distribution.new += Math.max(0, studentCount * skillCount - mastery.length);
  return distribution;
}
