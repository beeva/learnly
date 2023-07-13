import type {
  AttemptId,
  ClassroomId,
  CourseId,
  ItemId,
  LessonId,
  SessionId,
  SkillId,
  UnitId,
  UserId,
} from "./ids.js";

export type Role = "student" | "educator" | "admin";

export const GRADE_BANDS = ["k-2", "3-5", "6-8", "9-12"] as const;
export type GradeBand = (typeof GRADE_BANDS)[number];

export interface User {
  id: UserId;
  email: string;
  displayName: string;
  role: Role;
  gradeBand: GradeBand | null;
  avatarColor: string;
  locale: string;
  createdAt: string;
}

export type Subject = "math" | "reading" | "science";

export interface Course {
  id: CourseId;
  slug: string;
  title: string;
  subject: Subject;
  gradeBand: GradeBand;
  description: string;
  coverHue: number;
  unitCount: number;
  estimatedMinutes: number;
}

export interface Unit {
  id: UnitId;
  courseId: CourseId;
  position: number;
  title: string;
  summary: string;
  skills: Skill[];
}

export interface Skill {
  id: SkillId;
  unitId: UnitId;
  code: string;
  name: string;
  /** Skills that should be reasonably mastered before this one is introduced. */
  prerequisiteIds: SkillId[];
}

