import type { ClassroomId, SkillId, UserId } from "./ids.js";
import type { MasteryBand } from "./domain.js";

export interface SkillHotspot {
  skillId: SkillId;
  skillName: string;
  unitTitle: string;
  /** Share of attempts in the window that were incorrect. */
  errorRate: number;
  studentsStruggling: number;
  /** The most common wrong answer, if one clearly dominates. */
  commonMisconception: string | null;
}

export interface StudentSnapshot {
  userId: UserId;
  displayName: string;
  avatarColor: string;
  minutesThisWeek: number;
  streak: number;
  masteredSkills: number;
  needsAttention: boolean;
  lastActiveAt: string | null;
}

export interface ClassroomInsights {
  classroomId: ClassroomId;
  generatedAt: string;
  window: { from: string; to: string };
  completionRate: number;
  averageMinutesPerStudent: number;
  masteryDistribution: Record<MasteryBand, number>;
  hotspots: SkillHotspot[];
  students: StudentSnapshot[];
}

export interface MasteryHeatmapCell {
  userId: UserId;
  skillId: SkillId;
  pKnown: number;
  band: MasteryBand;
}

export interface MasteryHeatmap {
  skills: { id: SkillId; name: string }[];
  students: { id: UserId; displayName: string }[];
  cells: MasteryHeatmapCell[];
}
