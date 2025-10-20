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

export type LessonBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "callout"; tone: "tip" | "remember" | "try"; text: string }
  | { kind: "image"; src: string; alt: string; caption?: string }
  | { kind: "example"; prompt: string; steps: string[]; answer: string }
  | { kind: "check"; itemId: ItemId };

export interface Lesson {
  id: LessonId;
  skillId: SkillId;
  slug: string;
  title: string;
  /** 1 (gentle intro) .. 5 (stretch). */
  level: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes: number;
  blocks: LessonBlock[];
}

export type ItemKind = "multiple_choice" | "numeric" | "short_text" | "ordering";

interface ItemBase {
  id: ItemId;
  skillId: SkillId;
  kind: ItemKind;
  prompt: string;
  /** Calibrated difficulty on the logit scale, roughly -3 (easy) .. +3 (hard). */
  difficulty: number;
  hints: string[];
  explanation: string;
}

export interface MultipleChoiceItem extends ItemBase {
  kind: "multiple_choice";
  choices: { id: string; text: string }[];
  answer: string;
}

export interface NumericItem extends ItemBase {
  kind: "numeric";
  answer: number;
  tolerance: number;
  unit?: string;
}

export interface ShortTextItem extends ItemBase {
  kind: "short_text";
  acceptedAnswers: string[];
}

export interface OrderingItem extends ItemBase {
  kind: "ordering";
  entries: { id: string; text: string }[];
  answer: string[];
}

export type Item = MultipleChoiceItem | NumericItem | ShortTextItem | OrderingItem;

/** What the client receives: an item with its answer key removed. */
export type PublicItem =
  | Omit<MultipleChoiceItem, "answer" | "explanation">
  | Omit<NumericItem, "answer" | "tolerance" | "explanation">
  | Omit<ShortTextItem, "acceptedAnswers" | "explanation">
  | Omit<OrderingItem, "answer" | "explanation">;

export type Response =
  | { kind: "multiple_choice"; choiceId: string }
  | { kind: "numeric"; value: number }
  | { kind: "short_text"; text: string }
  | { kind: "ordering"; order: string[] };

export interface Attempt {
  id: AttemptId;
  userId: UserId;
  itemId: ItemId;
  skillId: SkillId;
  sessionId: SessionId | null;
  response: Response;
  correct: boolean;
  hintsUsed: number;
  durationMs: number;
  answeredAt: string;
}

export type MasteryBand = "new" | "learning" | "practicing" | "mastered";

export interface SkillMastery {
  skillId: SkillId;
  /** Probability (0..1) that the student has mastered the skill. */
  pKnown: number;
  /** Ability estimate on the same logit scale as item difficulty. */
  ability: number;
  band: MasteryBand;
  attempts: number;
  lastPracticedAt: string | null;
  /** When the spaced-repetition scheduler wants to see this skill again. */
  dueAt: string | null;
}

export type SessionKind = "diagnostic" | "practice" | "review";

export interface Session {
  id: SessionId;
  userId: UserId;
  courseId: CourseId;
  kind: SessionKind;
  startedAt: string;
  completedAt: string | null;
  itemsAnswered: number;
  itemsCorrect: number;
}

export interface NextItemResponse {
  session: Session;
  item: PublicItem | null;
  /** Human-friendly reason the engine picked this item, shown as a subtle hint. */
  rationale: string;
  progress: { answered: number; target: number };
}

export interface AttemptResult {
  attempt: Attempt;
  correct: boolean;
  explanation: string;
  correctResponse: Response;
  mastery: SkillMastery;
  xpEarned: number;
  encouragementKey: string;
}

export interface DiagnosticSummary {
  sessionId: SessionId;
  startingPoints: {
    skillId: SkillId;
    skillName: string;
    band: MasteryBand;
    pKnown: number;
  }[];
  recommendedLessonId: LessonId | null;
}

export interface Classroom {
  id: ClassroomId;
  name: string;
  educatorId: UserId;
  courseId: CourseId;
  joinCode: string;
  studentCount: number;
  createdAt: string;
}

export interface ClassroomMember {
  classroomId: ClassroomId;
  userId: UserId;
  displayName: string;
  avatarColor: string;
  joinedAt: string;
}
