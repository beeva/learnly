import { REASON_COPY, adaptiveTarget, applyAttempt, bandFor, initialMastery, selectNextItem, type Candidate } from "@learnly/adaptive-engine";
import {
  XP_RULES,
  advanceStreak,
  asId,
  levelForXp,
  xpForAttempt,
  type Attempt,
  type AttemptInput,
  type AttemptResult,
  type DiagnosticSummary,
  type EncouragementKey,
  type Item,
  type ItemId,
  type LessonId,
  type NextItemResponse,
  type PreferencesInput,
  type PublicItem,
  type Response,
  type Session,
  type SignUpInput,
  type SkillId,
  type SkillMastery,
  type StartSessionInput,
  type StreakState,
  type User,
} from "@learnly/shared";
import type { ActivityDay, Preferences, ProgressResponse, ProgressSummary, Recommendation, SessionCompleteResponse } from "../api/client";
import { ID_KIND, courseById, courseSkills, courses, items, itemsByCourse, lessons, lessonsBySkill, seedUuid, skillIdByCode, skills } from "./content";

/** Thrown by db operations; handlers turn it into the API's error envelope. */
export class MockHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const DAY_MS = 86_400_000;

export function dayKey(date = new Date()): string {
  // en-CA formats as YYYY-MM-DD in the learner's own timezone.
  return date.toLocaleDateString("en-CA");
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

/* ------------------------------------------------------------------ state */

interface StoredUser {
  user: User;
  password: string;
}

interface UserProgress {
  totalXp: number;
  streak: StreakState;
  activity: Record<string, { minutes: number; itemsCorrect: number }>;
  completedLessons: string[];
  diagnosedCourses: string[];
  lastLessonId: string | null;
}

interface MockSession {
  session: Session;
  targetItems: number;
  servedItemIds: string[];
  answeredItemIds: string[];
  recentSkillIds: string[];
  recentCorrect: boolean[];
  currentItemId: string | null;
  rationale: string;
  xpEarned: number;
}

interface RefreshRecord {
  userId: string;
  family: string;
  rotated: boolean;
}

interface DbState {
  version: 3;
  users: StoredUser[];
  preferences: Record<string, Preferences>;
  mastery: Record<string, Record<string, SkillMastery>>;
  progress: Record<string, UserProgress>;
  sessions: Record<string, MockSession>;
  refreshTokens: Record<string, RefreshRecord>;
  attempts: Record<string, AttemptResult>;
}

const STORAGE_KEY = "learnly.mock-db.v3";

export const DEFAULT_PREFERENCES: Preferences = { dailyGoalMinutes: 15, reducedMotion: false, soundEffects: true, locale: "en" };

function emptyProgress(): UserProgress {
  return {
    totalXp: 0,
    streak: { current: 0, longest: 0, lastActiveDay: null, freezesAvailable: 1 },
    activity: {},
    completedLessons: [],
    diagnosedCourses: [],
    lastLessonId: null,
  };
}

function seededMastery(code: string, ability: number, attempts: number, practicedDaysAgo: number): SkillMastery {
  const skillId = skillIdByCode.get(code);
  if (!skillId) throw new Error(`Unknown skill code ${code}`);
  const base = initialMastery(asId<SkillId>(skillId), ability);
  return {
    ...base,
    attempts,
    band: bandFor(base.pKnown, attempts),
    lastPracticedAt: daysAgo(practicedDaysAgo).toISOString(),
    dueAt: daysAgo(practicedDaysAgo - 4).toISOString(),
  };
}

function firstLessonOf(code: string): string {
  const id = lessonsBySkill.get(skillIdByCode.get(code) ?? "")?.[0];
  if (!id) throw new Error(`No lesson for ${code}`);
  return id;
}

export const DEMO_STUDENT_ID = seedUuid(ID_KIND.user, 1);
export const DEMO_EDUCATOR_ID = seedUuid(ID_KIND.user, 2);

function seedState(): DbState {
  const maya: User = {
    id: asId(DEMO_STUDENT_ID),
    email: "maya@learnly.app",
    displayName: "Maya Santos",
    role: "student",
    gradeBand: "3-5",
    avatarColor: "#FF7A59",
    locale: "en",
    createdAt: daysAgo(41).toISOString(),
  };
  const rivera: User = {
    id: asId(DEMO_EDUCATOR_ID),
    email: "rivera@learnly.app",
    displayName: "Elena Rivera",
    role: "educator",
    gradeBand: null,
    avatarColor: "#5B5BD6",
    locale: "en",
    createdAt: daysAgo(120).toISOString(),
  };

  const mayaMastery = [
    seededMastery("3.NF.1", 2.81, 9, 5),
    seededMastery("3.NF.2", 1.44, 6, 2),
    seededMastery("4.NF.1", 0.34, 4, 1),
    seededMastery("RI.3.2", 1.08, 3, 3),
  ];

  const minutes = [11, 15, 22, 9, 18, 12];
  const activity: UserProgress["activity"] = {};
  minutes.forEach((value, index) => {
    activity[dayKey(daysAgo(index + 1))] = { minutes: value, itemsCorrect: Math.round(value * 0.9) };
  });

  return {
    version: 3,
    users: [
      { user: maya, password: "learnly-demo-1" },
      { user: rivera, password: "learnly-demo-1" },
    ],
    preferences: { [maya.id]: { ...DEFAULT_PREFERENCES }, [rivera.id]: { ...DEFAULT_PREFERENCES, dailyGoalMinutes: 10 } },
    mastery: { [maya.id]: Object.fromEntries(mayaMastery.map((m) => [m.skillId, m])) },
    progress: {
      [maya.id]: {
        totalXp: 740,
        streak: { current: 6, longest: 14, lastActiveDay: dayKey(daysAgo(1)), freezesAvailable: 1 },
        activity,
        completedLessons: [firstLessonOf("3.NF.1"), firstLessonOf("3.NF.2")],
        diagnosedCourses: ["fractions-foundations"],
        lastLessonId: firstLessonOf("4.NF.1"),
      },
      [rivera.id]: emptyProgress(),
    },
    sessions: {},
    refreshTokens: {},
    attempts: {},
  };
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DbState;
      if (parsed.version === 3) return parsed;
    }
  } catch {
    /* corrupted or unavailable storage: start fresh */
  }
  return seedState();
}

let state: DbState = load();

/** Persist so the demo survives reloads (and the service worker's restarts). */
export function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode */
  }
}

export function resetDb(): void {
  state = seedState();
  save();
}

/* ------------------------------------------------------------------- auth */

const ACCESS_TTL_SECONDS = 15 * 60;

function base64Url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function issueTokens(userId: string, family: string = crypto.randomUUID()) {
  const accessToken = [
    base64Url({ alg: "none", typ: "JWT" }),
    base64Url({ sub: userId, exp: Math.floor(Date.now() / 1000) + ACCESS_TTL_SECONDS }),
    "mock",
  ].join(".");
  const refreshToken = `rt_${crypto.randomUUID().replace(/-/g, "")}`;
  state.refreshTokens[refreshToken] = { userId, family, rotated: false };
  save();
  return { accessToken, refreshToken };
}

/** Rotation with reuse detection: presenting an already-rotated token revokes its family. */
export function rotateRefreshToken(token: string) {
  const record = state.refreshTokens[token];
  if (!record) throw new MockHttpError(401, "unauthorized", "Your session has expired. Please sign in again.");
  if (record.rotated) {
    for (const [key, value] of Object.entries(state.refreshTokens)) if (value.family === record.family) delete state.refreshTokens[key];
    save();
    throw new MockHttpError(401, "unauthorized", "This session was used somewhere else. Please sign in again.");
  }
  record.rotated = true;
  return issueTokens(record.userId, record.family);
}

export function revokeRefreshToken(token: string): void {
  const record = state.refreshTokens[token];
  if (!record) return;
  for (const [key, value] of Object.entries(state.refreshTokens)) if (value.family === record.family) delete state.refreshTokens[key];
  save();
}

export function findUser(userId: string): User | undefined {
  return state.users.find((entry) => entry.user.id === userId)?.user;
}

export function userFromAuthHeader(header: string | null): User | null {
  if (!header?.startsWith("Bearer ")) return null;
  const payload = header.slice(7).split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string; exp?: number };
    if (!claims.sub || !claims.exp || claims.exp * 1000 < Date.now()) return null;
    return findUser(claims.sub) ?? null;
  } catch {
    return null;
  }
}

const AVATAR_COLORS = ["#5B5BD6", "#FF7A59", "#2FB67C", "#F5A524", "#E25C9A", "#2E9CCA", "#8A63D2"];

export function signUp(input: SignUpInput): User {
  if (state.users.some((entry) => entry.user.email === input.email)) {
    throw new MockHttpError(409, "conflict", "An account with this email already exists.");
  }
  const user: User = {
    id: asId(crypto.randomUUID()),
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    gradeBand: input.role === "student" ? input.gradeBand : null,
    avatarColor: AVATAR_COLORS[Math.abs(hash(input.email)) % AVATAR_COLORS.length] ?? "#5B5BD6",
    locale: "en",
    createdAt: new Date().toISOString(),
  };
  state.users.push({ user, password: input.password });
  state.preferences[user.id] = { ...DEFAULT_PREFERENCES };
  state.progress[user.id] = emptyProgress();
  state.mastery[user.id] = {};
  save();
  return user;
}

export function signIn(email: string, password: string): User {
  const entry = state.users.find((candidate) => candidate.user.email === email.trim().toLowerCase());
  if (!entry || entry.password !== password) throw new MockHttpError(401, "unauthorized", "Email or password is incorrect.");
  return entry.user;
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  return h;
}

/* ------------------------------------------------------------ preferences */

export function preferencesOf(userId: string): Preferences {
  return (state.preferences[userId] ??= { ...DEFAULT_PREFERENCES });
}

export function updatePreferences(userId: string, input: PreferencesInput): Preferences {
  const entry = state.users.find((candidate) => candidate.user.id === userId);
  if (!entry) throw new MockHttpError(404, "not_found", "User not found.");
  const { displayName, avatarColor, ...rest } = input;
  if (displayName) entry.user = { ...entry.user, displayName };
  if (avatarColor) entry.user = { ...entry.user, avatarColor };
  if (rest.locale) entry.user = { ...entry.user, locale: rest.locale };
  const current = preferencesOf(userId);
  const next: Preferences = {
    dailyGoalMinutes: rest.dailyGoalMinutes ?? current.dailyGoalMinutes,
    reducedMotion: rest.reducedMotion ?? current.reducedMotion,
    soundEffects: rest.soundEffects ?? current.soundEffects,
    locale: rest.locale ?? current.locale,
  };
  state.preferences[userId] = next;
  save();
  return next;
}

/* --------------------------------------------------------------- progress */

function progressOf(userId: string): UserProgress {
  return (state.progress[userId] ??= emptyProgress());
}

function masteryOf(userId: string): Record<string, SkillMastery> {
  return (state.mastery[userId] ??= {});
}

export function masteryFor(userId: string, skillId: string): SkillMastery {
  return masteryOf(userId)[skillId] ?? initialMastery(asId<SkillId>(skillId));
}

/** The streak as it should be displayed today: broken streaks read as zero. */
function displayedStreak(streak: StreakState): StreakState {
  if (!streak.lastActiveDay) return streak;
  const gap = Math.round((Date.parse(`${dayKey()}T00:00:00Z`) - Date.parse(`${streak.lastActiveDay}T00:00:00Z`)) / DAY_MS);
  if (gap <= 1) return streak;
  if (gap === 2 && streak.freezesAvailable > 0) return streak;
  return { ...streak, current: 0 };
}

function recordActivity(userId: string, minutes: number, itemsCorrect: number) {
  const progress = progressOf(userId);
  const today = dayKey();
  progress.streak = advanceStreak(progress.streak, today);
  const entry = (progress.activity[today] ??= { minutes: 0, itemsCorrect: 0 });
  entry.minutes += minutes;
  entry.itemsCorrect += itemsCorrect;
}

export function progressSummary(userId: string): ProgressSummary {
  const progress = progressOf(userId);
  return {
    totalXp: progress.totalXp,
    level: levelForXp(progress.totalXp),
    streak: displayedStreak(progress.streak),
    minutesToday: Math.round(progress.activity[dayKey()]?.minutes ?? 0),
    dailyGoalMinutes: preferencesOf(userId).dailyGoalMinutes,
  };
}

export function recentActivity(userId: string, days = 7): ActivityDay[] {
  const progress = progressOf(userId);
  return Array.from({ length: days }, (_, i) => {
    const day = dayKey(daysAgo(days - 1 - i));
    const entry = progress.activity[day];
    return { day, minutes: Math.round(entry?.minutes ?? 0), itemsCorrect: entry?.itemsCorrect ?? 0 };
  });
}

export function progressResponse(userId: string): ProgressResponse {
  return { ...progressSummary(userId), mastery: Object.values(masteryOf(userId)), recentActivity: recentActivity(userId) };
}

export function courseMastery(userId: string, courseId: string): SkillMastery[] {
  const record = courseById(courseId);
  if (!record) return [];
  return courseSkills(record).map((skill) => masteryFor(userId, skill.id));
}

/* ---------------------------------------------------------------- lessons */

export function openLesson(userId: string, lessonId: string): void {
  const progress = progressOf(userId);
  if (!progress.completedLessons.includes(lessonId)) {
    progress.lastLessonId = lessonId;
    save();
  }
}

export function completeLesson(userId: string, lessonId: string, durationMs: number) {
  if (!lessons.has(lessonId)) throw new MockHttpError(404, "not_found", "Lesson not found.");
  const progress = progressOf(userId);
  const firstTime = !progress.completedLessons.includes(lessonId);
  const xpEarned = firstTime ? XP_RULES.lessonComplete : 5;
  progress.totalXp += xpEarned;
  if (firstTime) progress.completedLessons.push(lessonId);
  if (progress.lastLessonId === lessonId) progress.lastLessonId = null;
  recordActivity(userId, Math.max(1, durationMs / 60_000), 0);
  save();
  return { xpEarned, progress: progressSummary(userId) };
}

/* ---------------------------------------------------------------- answers */

export function toPublicItem(item: Item): PublicItem {
  switch (item.kind) {
    case "multiple_choice": {
      const { answer, explanation, ...rest } = item;
      return rest;
    }
    case "numeric": {
      const { answer, tolerance, explanation, ...rest } = item;
      return rest;
    }
    case "short_text": {
      const { acceptedAnswers, explanation, ...rest } = item;
      return rest;
    }
    case "ordering": {
      const { answer, explanation, ...rest } = item;
      return rest;
    }
  }
}

export function correctResponseOf(item: Item): Response {
  switch (item.kind) {
    case "multiple_choice":
      return { kind: "multiple_choice", choiceId: item.answer };
    case "numeric":
      return { kind: "numeric", value: item.answer };
    case "short_text":
      return { kind: "short_text", text: item.acceptedAnswers[0] ?? "" };
    case "ordering":
      return { kind: "ordering", order: item.answer };
  }
}

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");

function fractionValue(value: string): number | null {
  const compact = value.replace(/\s/g, "");
  const match = /^(-?\d+)\/(\d+)$/.exec(compact);
  if (match) {
    const denominator = Number(match[2]);
    return denominator === 0 ? null : Number(match[1]) / denominator;
  }
  const n = Number(compact);
  return compact !== "" && Number.isFinite(n) ? n : null;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = temp;
    }
  }
  return row[b.length]!;
}

/** Score a response. `close` powers the "So close — check the last step" encouragement. */
export function evaluate(item: Item, response: Response): { correct: boolean; close: boolean } {
  if (item.kind !== response.kind) return { correct: false, close: false };
  switch (item.kind) {
    case "multiple_choice":
      return { correct: response.kind === "multiple_choice" && response.choiceId === item.answer, close: false };
    case "numeric": {
      if (response.kind !== "numeric") return { correct: false, close: false };
      const diff = Math.abs(response.value - item.answer);
      const correct = diff <= item.tolerance + 1e-9;
      return { correct, close: !correct && diff <= Math.max(1, Math.abs(item.answer) * 0.1) };
    }
    case "short_text": {
      if (response.kind !== "short_text") return { correct: false, close: false };
      const given = normalize(response.text);
      const accepted = item.acceptedAnswers.map(normalize);
      const correct = accepted.some((answer) => answer === given || answer.replace(/\s/g, "") === given.replace(/\s/g, ""));
      if (correct) return { correct, close: false };
      const givenValue = fractionValue(given);
      const close = accepted.some((answer) => {
        const value = fractionValue(answer);
        if (value !== null && givenValue !== null) return Math.abs(value - givenValue) < 1e-9;
        return answer.length > 4 && editDistance(answer, given) <= 2;
      });
      return { correct, close };
    }
    case "ordering": {
      if (response.kind !== "ordering") return { correct: false, close: false };
      const misplaced = item.answer.filter((id, index) => response.order[index] !== id).length;
      return { correct: misplaced === 0 && response.order.length === item.answer.length, close: misplaced > 0 && misplaced <= 2 };
    }
  }
}

/* --------------------------------------------------------------- sessions */

const DEFAULT_TARGET = { diagnostic: 6, practice: 8, review: 5 } as const;
const DIAGNOSTIC_RATIONALE = "Just finding your starting point — it's okay to guess.";

function candidateOf(item: Item): Candidate {
  return { id: item.id, skillId: item.skillId, difficulty: item.difficulty };
}

function prerequisitesMet(userId: string, skillId: string): boolean {
  const skill = skills.get(skillId);
  if (!skill) return false;
  return skill.prerequisiteIds.every((id) => masteryFor(userId, id).pKnown >= 0.6);
}

function pickItem(userId: string, ms: MockSession): { itemId: string; rationale: string } | null {
  const pool = (itemsByCourse.get(ms.session.courseId) ?? [])
    .filter((id) => !ms.servedItemIds.includes(id))
    .map((id) => items.get(id))
    .filter((item): item is Item => Boolean(item));
  if (pool.length === 0) return null;

  const mastery = new Map<SkillId, SkillMastery>(Object.values(masteryOf(userId)).map((m) => [m.skillId, m]));
  const options = {
    recentItemIds: ms.servedItemIds as ItemId[],
    recentSkillIds: ms.recentSkillIds as SkillId[],
  };

  let candidates = pool;
  let targetSuccess = adaptiveTarget(ms.recentCorrect);

  if (ms.session.kind === "diagnostic") {
    // Breadth first: probe every skill once before probing any skill twice.
    const probes = new Map<string, number>();
    for (const id of ms.servedItemIds) {
      const skillId = items.get(id)?.skillId;
      if (skillId) probes.set(skillId, (probes.get(skillId) ?? 0) + 1);
    }
    const fewest = Math.min(...pool.map((item) => probes.get(item.skillId) ?? 0));
    candidates = pool.filter((item) => (probes.get(item.skillId) ?? 0) === fewest);
    targetSuccess = 0.6;
  } else if (ms.session.kind === "review") {
    const practiced = pool.filter((item) => masteryFor(userId, item.skillId).attempts > 0);
    if (practiced.length > 0) candidates = practiced;
  } else {
    const unlocked = pool.filter((item) => masteryFor(userId, item.skillId).attempts > 0 || prerequisitesMet(userId, item.skillId));
    const growing = unlocked.filter((item) => masteryFor(userId, item.skillId).band !== "mastered");
    candidates = growing.length >= 2 ? growing : unlocked.length > 0 ? unlocked : pool;
  }

  const selection = selectNextItem(candidates.map(candidateOf), mastery, { ...options, targetSuccess });
  if (!selection) return null;
  return {
    itemId: selection.item.id,
    rationale: ms.session.kind === "diagnostic" ? DIAGNOSTIC_RATIONALE : REASON_COPY[selection.reason],
  };
}

function sessionFor(userId: string, sessionId: string): MockSession {
  const ms = state.sessions[sessionId];
  if (!ms || ms.session.userId !== userId) throw new MockHttpError(404, "not_found", "Session not found.");
  return ms;
}

function nextResponse(userId: string, ms: MockSession): NextItemResponse {
  const progress = { answered: ms.session.itemsAnswered, target: ms.targetItems };
  if (ms.session.completedAt || ms.session.itemsAnswered >= ms.targetItems) {
    return { session: ms.session, item: null, rationale: "", progress };
  }
  if (!ms.currentItemId) {
    const pick = pickItem(userId, ms);
    if (!pick) return { session: ms.session, item: null, rationale: "", progress };
    ms.currentItemId = pick.itemId;
    ms.rationale = pick.rationale;
    ms.servedItemIds.push(pick.itemId);
    save();
  }
  const item = items.get(ms.currentItemId);
  if (!item) throw new MockHttpError(500, "internal", "Item disappeared.");
  return { session: ms.session, item: toPublicItem(item), rationale: ms.rationale, progress };
}

export function startSession(userId: string, input: StartSessionInput): NextItemResponse {
  const record = courseById(input.courseId);
  if (!record) throw new MockHttpError(404, "not_found", "Course not found.");
  const session: Session = {
    id: asId(crypto.randomUUID()),
    userId: asId(userId),
    courseId: record.course.id,
    kind: input.kind,
    startedAt: new Date().toISOString(),
    completedAt: null,
    itemsAnswered: 0,
    itemsCorrect: 0,
  };
  const ms: MockSession = {
    session,
    targetItems: input.targetItems ?? DEFAULT_TARGET[input.kind],
    servedItemIds: [],
    answeredItemIds: [],
    recentSkillIds: [],
    recentCorrect: [],
    currentItemId: null,
    rationale: "",
    xpEarned: 0,
  };
  state.sessions[session.id] = ms;
  return nextResponse(userId, ms);
}

export function nextItem(userId: string, sessionId: string): NextItemResponse {
  return nextResponse(userId, sessionFor(userId, sessionId));
}

export function completeSession(userId: string, sessionId: string): SessionCompleteResponse {
  const ms = sessionFor(userId, sessionId);
  const progress = progressOf(userId);
  const record = courseById(ms.session.courseId);
  let summary: DiagnosticSummary | undefined;

  if (!ms.session.completedAt) {
    ms.session = { ...ms.session, completedAt: new Date().toISOString() };
    if (ms.session.kind === "diagnostic") {
      ms.xpEarned += XP_RULES.diagnosticComplete;
      progress.totalXp += XP_RULES.diagnosticComplete;
      if (record && !progress.diagnosedCourses.includes(record.course.slug)) progress.diagnosedCourses.push(record.course.slug);
    }
  }

  if (ms.session.kind === "diagnostic" && record) {
    const probed = new Set(ms.answeredItemIds.map((id) => items.get(id)?.skillId).filter(Boolean));
    const skillList = courseSkills(record).filter((skill) => probed.has(skill.id));
    const startingPoints = skillList.map((skill) => {
      const mastery = masteryFor(userId, skill.id);
      return { skillId: skill.id, skillName: skill.name, band: mastery.band, pKnown: mastery.pKnown };
    });
    const firstGap = courseSkills(record).find((skill) => masteryFor(userId, skill.id).pKnown < 0.85 && prerequisitesMet(userId, skill.id));
    const lessonId = lessonsBySkill.get(firstGap?.id ?? courseSkills(record)[0]?.id ?? "")?.[0] ?? null;
    summary = { sessionId: ms.session.id, startingPoints, recommendedLessonId: lessonId ? asId<LessonId>(lessonId) : null };
  }

  save();
  return { session: ms.session, xpEarned: ms.xpEarned, ...(summary ? { summary } : {}) };
}

/* --------------------------------------------------------------- attempts */

function trailing(values: boolean[], value: boolean): number {
  let count = 0;
  for (let i = values.length - 1; i >= 0 && values[i] === value; i--) count++;
  return count;
}

const recentOutcomes = new Map<string, boolean[]>();

export function recordAttempt(userId: string, input: AttemptInput): AttemptResult {
  if (input.clientAttemptId) {
    const existing = state.attempts[input.clientAttemptId];
    if (existing) return existing;
  }
  const item = items.get(input.itemId);
  if (!item) throw new MockHttpError(404, "not_found", "Item not found.");
  if (item.kind !== input.response.kind) {
    throw new MockHttpError(400, "validation_failed", "Response kind does not match the item.");
  }
  const ms = input.sessionId ? sessionFor(userId, input.sessionId) : null;
  const { correct, close } = evaluate(item, input.response);
  const answeredAt = input.answeredAt ?? new Date().toISOString();

  const before = masteryFor(userId, item.skillId);
  const applied = applyAttempt(before, { difficulty: item.difficulty, correct, hintsUsed: input.hintsUsed, answeredAt });
  const reviewInDays = applied.band === "mastered" ? 7 : applied.band === "practicing" ? 3 : 1;
  const after: SkillMastery = { ...applied, dueAt: new Date(Date.parse(answeredAt) + reviewInDays * DAY_MS).toISOString() };
  masteryOf(userId)[item.skillId] = after;

  const firstTry = input.hintsUsed === 0 && !(ms?.answeredItemIds.includes(item.id) ?? false);
  const xpEarned = xpForAttempt(correct, input.hintsUsed, firstTry);
  const progress = progressOf(userId);
  const levelBefore = levelForXp(progress.totalXp).level;
  progress.totalXp += xpEarned;
  recordActivity(userId, Math.min(5, input.durationMs / 60_000), correct ? 1 : 0);

  const outcomes = ms ? ms.recentCorrect : (recentOutcomes.get(userId) ?? []);
  outcomes.push(correct);
  if (!ms) recentOutcomes.set(userId, outcomes.slice(-10));
  if (ms) {
    ms.session = {
      ...ms.session,
      itemsAnswered: ms.session.itemsAnswered + 1,
      itemsCorrect: ms.session.itemsCorrect + (correct ? 1 : 0),
    };
    ms.answeredItemIds.push(item.id);
    ms.recentSkillIds = [...ms.recentSkillIds, item.skillId].slice(-6);
    ms.currentItemId = null;
    ms.xpEarned += xpEarned;
  }

  let encouragementKey: EncouragementKey;
  if (before.band !== "mastered" && after.band === "mastered") encouragementKey = "mastered";
  else if (correct && levelForXp(progress.totalXp).level > levelBefore) encouragementKey = "level_up";
  else if (correct) {
    encouragementKey =
      trailing(outcomes, true) >= 3
        ? "correct_streak"
        : input.hintsUsed > 0
          ? "correct_after_hint"
          : item.difficulty - before.ability > 0.75
            ? "correct_hard"
            : "correct";
  } else {
    encouragementKey = close ? "incorrect_close" : trailing(outcomes, false) >= 2 ? "incorrect_again" : "incorrect_first";
  }

  const attempt: Attempt = {
    id: asId(crypto.randomUUID()),
    userId: asId(userId),
    itemId: item.id,
    skillId: item.skillId,
    sessionId: ms ? ms.session.id : null,
    response: input.response,
    correct,
    hintsUsed: input.hintsUsed,
    durationMs: input.durationMs,
    answeredAt,
  };

  const result: AttemptResult = {
    attempt,
    correct,
    explanation: item.explanation,
    correctResponse: correctResponseOf(item),
    mastery: after,
    xpEarned,
    encouragementKey,
  };
  if (input.clientAttemptId) state.attempts[input.clientAttemptId] = result;
  save();
  return result;
}

/* -------------------------------------------------------- recommendations */

export function recommendations(userId: string): Recommendation[] {
  const user = findUser(userId);
  const progress = progressOf(userId);
  const out: Recommendation[] = [];

  const lastLesson = progress.lastLessonId ? lessons.get(progress.lastLessonId) : undefined;
  if (lastLesson) {
    const skill = skills.get(lastLesson.skillId);
    const record = skill ? courseById(skill.courseId) : undefined;
    if (record) {
      out.push({
        type: "lesson",
        title: lastLesson.title,
        subtitle: `${record.course.title} · ${skill?.name ?? ""}`,
        lessonId: lastLesson.id,
        courseSlug: record.course.slug,
        estimatedMinutes: lastLesson.estimatedMinutes,
      });
    }
  }

  const active = (record: (typeof courses)[number]) => courseSkills(record).some((skill) => masteryFor(userId, skill.id).attempts > 0);
  const preferred = courses
    .filter((record) => !user?.gradeBand || record.course.gradeBand === user.gradeBand)
    .sort((a, b) => Number(active(b)) - Number(active(a)));
  const pool = preferred.length > 0 ? preferred : courses;

  pool.forEach((record, index) => {
    if (out.length >= 5) return;
    const { course } = record;
    if (!progress.diagnosedCourses.includes(course.slug)) {
      if (index === 0 || out.length < 3) {
        out.push({
          type: "diagnostic",
          title: `Find your starting point in ${course.title}`,
          subtitle: "A calm, six-question check-in. No grades — just where to begin.",
          courseSlug: course.slug,
          estimatedMinutes: 5,
        });
      }
      return;
    }

    const nextSkill = courseSkills(record).find((skill) => {
      const lessonId = lessonsBySkill.get(skill.id)?.[0];
      return (
        lessonId &&
        lessonId !== progress.lastLessonId &&
        !progress.completedLessons.includes(lessonId) &&
        masteryFor(userId, skill.id).band !== "mastered" &&
        prerequisitesMet(userId, skill.id)
      );
    });
    const nextLessonId = nextSkill ? lessonsBySkill.get(nextSkill.id)?.[0] : undefined;
    const nextLesson = nextLessonId ? lessons.get(nextLessonId) : undefined;
    if (nextLesson && nextSkill) {
      out.push({
        type: "lesson",
        title: nextLesson.title,
        subtitle: `Up next in ${course.title}`,
        lessonId: nextLesson.id,
        courseSlug: course.slug,
        estimatedMinutes: nextLesson.estimatedMinutes,
      });
    }

    const practiced = courseSkills(record)
      .map((skill) => ({ skill, mastery: masteryFor(userId, skill.id) }))
      .filter(({ mastery }) => mastery.attempts > 0 && mastery.band !== "mastered")
      .sort((a, b) => a.mastery.pKnown - b.mastery.pKnown);
    const focus = practiced[0];
    out.push({
      type: "practice",
      title: focus ? `Practice: ${focus.skill.name}` : `Practice ${course.title}`,
      subtitle: "A short adaptive set that meets you where you are.",
      courseSlug: course.slug,
      estimatedMinutes: 6,
    });

    const due = courseSkills(record).filter((skill) => {
      const mastery = masteryFor(userId, skill.id);
      return mastery.band === "mastered" && mastery.dueAt !== null && Date.parse(mastery.dueAt) <= Date.now();
    });
    if (due.length > 0) {
      out.push({
        type: "review",
        title: "Quick review",
        subtitle: `Keep ${due.map((skill) => skill.name).join(" and ")} fresh.`,
        courseSlug: course.slug,
        estimatedMinutes: 4,
      });
    }
  });

  return out.slice(0, 5);
}

type Classroom = import("@learnly/shared").Classroom;
type ClassroomMember = import("@learnly/shared").ClassroomMember;
type ClassroomInsights = import("@learnly/shared").ClassroomInsights;
type MasteryHeatmap = import("@learnly/shared").MasteryHeatmap;
type MasteryBand = import("@learnly/shared").MasteryBand;
type SkillHotspot = import("@learnly/shared").SkillHotspot;
type StudentSnapshot = import("@learnly/shared").StudentSnapshot;

interface RosterStudent {
  id: string;
  displayName: string;
  avatarColor: string;
  joinedAt: string;
  minutesThisWeek: number;
  streak: number;
  lastActiveDaysAgo: number | null;
  /** skillId → pKnown, for skills the student has attempted. */
  mastery: Record<string, number>;
  /** skillId → attempts, used for error rates. */
  attempts: Record<string, number>;
}

interface EducatorState {
  version: 1;
  classrooms: Classroom[];
  rosters: Record<string, RosterStudent[]>;
}

const EDUCATOR_KEY = "learnly.mock-educator.v1";

/** Small deterministic PRNG so the demo roster looks identical on every visit. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  "Amara", "Diego", "Hana", "Liam", "Priya", "Mateo", "Zoe", "Kofi", "Sofia", "Ethan", "Aiyana", "Noah",
  "Mei", "Lucas", "Fatima", "Oliver", "Isabela", "Jamal", "Chloe", "Ravi", "Nora", "Theo", "Yuki", "Malik",
  "Elena", "Sam", "Ines", "Kai", "Leah", "Omar",
];
const LAST_INITIALS = "ABCDEFGHJKLMNOPRSTVWY";

const MISCONCEPTIONS: Record<string, string> = {
  "3.NF.1": "Counts all slices as the numerator (writes 8/3 instead of 3/8)",
  "3.NF.2": "Treats the number of tick marks as the denominator",
  "4.NF.1": "Adds the same number to top and bottom (2/3 → 3/4)",
  "4.NF.1b": "Divides only the numerator when simplifying",
  "4.NF.2": "Thinks a bigger denominator means a bigger fraction (3/8 > 3/5)",
  "4.NF.3": "Adds the denominators too (1/4 + 1/4 = 2/8)",
  "6.EE.1": "Works strictly left to right (3 + 4 × 2 = 14)",
  "6.EE.2c": "Reads 4x as forty-something when x is substituted",
  "6.EE.7": "Applies the same operation instead of the inverse",
  "7.EE.4": "Divides before undoing the addition",
};

function buildRoster(courseId: string, count: number, seed: number): RosterStudent[] {
  const random = mulberry32(seed);
  const record = courseById(courseId);
  const skillList = record ? courseSkills(record) : [];
  return Array.from({ length: count }, (_, index) => {
    const name = `${FIRST_NAMES[(index * 7 + seed) % FIRST_NAMES.length]} ${LAST_INITIALS[Math.floor(random() * LAST_INITIALS.length)]}.`;
    // Each student has an overall strength and progresses through the course to a point.
    const strength = 0.25 + random() * 0.7;
    const reach = Math.max(1, Math.round(skillList.length * (0.35 + random() * 0.65)));
    const mastery: Record<string, number> = {};
    const attempts: Record<string, number> = {};
    skillList.slice(0, reach).forEach((skill, position) => {
      const decay = position * 0.07;
      const hard = skill.code === "4.NF.3" || skill.code === "4.NF.2" || skill.code === "7.EE.4" ? 0.18 : 0;
      const p = Math.min(0.98, Math.max(0.05, strength - decay - hard + (random() - 0.5) * 0.25));
      mastery[skill.id] = Number(p.toFixed(2));
      attempts[skill.id] = 3 + Math.floor(random() * 9);
    });
    const disengaged = random() < 0.16;
    return {
      id: seedUuid(ID_KIND.user, 1000 + seed * 100 + index),
      displayName: name,
      avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length] ?? "#5B5BD6",
      joinedAt: daysAgo(30 + Math.floor(random() * 20)).toISOString(),
      minutesThisWeek: disengaged ? Math.floor(random() * 12) : 25 + Math.floor(random() * 75),
      streak: disengaged ? 0 : Math.floor(random() * 15),
      lastActiveDaysAgo: disengaged ? 6 + Math.floor(random() * 8) : Math.floor(random() * 3),
      mastery,
      attempts,
    };
  });
}

function seedEducatorState(): EducatorState {
  const fractions = courses.find((record) => record.course.slug === "fractions-foundations");
  const algebra = courses.find((record) => record.course.slug === "algebra-readiness");
  const classrooms: Classroom[] = [];
  const rosters: Record<string, RosterStudent[]> = {};
  const add = (n: number, name: string, courseId: string | undefined, code: string, students: number, seed: number) => {
    if (!courseId) return;
    const id = seedUuid(ID_KIND.classroom, n);
    rosters[id] = buildRoster(courseId, students, seed);
    classrooms.push({
      id: asId(id),
      name,
      educatorId: asId(DEMO_EDUCATOR_ID),
      courseId: asId(courseId),
      joinCode: code,
      studentCount: students,
      createdAt: daysAgo(60 - n * 7).toISOString(),
    });
  };
  add(1, "Period 2 · Fractions", fractions?.course.id, "FRAC24", 24, 3);
  add(2, "Period 5 · Algebra Readiness", algebra?.course.id, "ALG7KM", 18, 5);
  return { version: 1, classrooms, rosters };
}

function loadEducator(): EducatorState {
  try {
    const raw = localStorage.getItem(EDUCATOR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as EducatorState;
      if (parsed.version === 1) return parsed;
    }
  } catch {
    /* ignore */
  }
  return seedEducatorState();
}

let educator: EducatorState = loadEducator();

function saveEducator() {
  try {
    localStorage.setItem(EDUCATOR_KEY, JSON.stringify(educator));
  } catch {
    /* ignore */
  }
}

export function resetEducatorDb(): void {
  educator = seedEducatorState();
  saveEducator();
}

const JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newJoinCode(): string {
  let code = "";
  do {
    code = Array.from({ length: 6 }, () => JOIN_ALPHABET[Math.floor(Math.random() * JOIN_ALPHABET.length)]).join("");
  } while (educator.classrooms.some((classroom) => classroom.joinCode === code));
  return code;
}

export function classroomsFor(user: User): Classroom[] {
  if (user.role === "student") {
    return educator.classrooms.filter((classroom) => (educator.rosters[classroom.id] ?? []).some((student) => student.id === user.id));
  }
  return educator.classrooms.filter((classroom) => user.role === "admin" || classroom.educatorId === user.id);
}

function ownedClassroom(user: User, classroomId: string): Classroom {
  const classroom = educator.classrooms.find((candidate) => candidate.id === classroomId);
  if (!classroom) throw new MockHttpError(404, "not_found", "Classroom not found.");
  if (user.role !== "admin" && classroom.educatorId !== user.id) throw new MockHttpError(403, "forbidden", "This classroom belongs to another educator.");
  return classroom;
}

export function createClassroom(user: User, input: { name: string; courseId: string }): Classroom {
  if (!courseById(input.courseId)) throw new MockHttpError(400, "validation_failed", "Pick a course for this classroom.");
  const classroom: Classroom = {
    id: asId(crypto.randomUUID()),
    name: input.name,
    educatorId: user.id,
    courseId: asId(input.courseId),
    joinCode: newJoinCode(),
    studentCount: 0,
    createdAt: new Date().toISOString(),
  };
  educator.classrooms.unshift(classroom);
  educator.rosters[classroom.id] = [];
  saveEducator();
  return classroom;
}

export function joinClassroom(user: User, joinCode: string): Classroom {
  const classroom = educator.classrooms.find((candidate) => candidate.joinCode === joinCode.toUpperCase());
  if (!classroom) throw new MockHttpError(404, "not_found", "We couldn't find a class with that code.");
  const roster = (educator.rosters[classroom.id] ??= []);
  if (roster.some((student) => student.id === user.id)) throw new MockHttpError(409, "conflict", "You're already in this class.");
  const record = courseById(classroom.courseId);
  const mastery: Record<string, number> = {};
  const attempts: Record<string, number> = {};
  for (const skill of record ? courseSkills(record) : []) {
    const m = masteryFor(user.id, skill.id);
    if (m.attempts > 0) {
      mastery[skill.id] = m.pKnown;
      attempts[skill.id] = m.attempts;
    }
  }
  const summary = progressSummary(user.id);
  roster.push({
    id: user.id,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    joinedAt: new Date().toISOString(),
    minutesThisWeek: recentActivity(user.id).reduce((sum, day) => sum + day.minutes, 0),
    streak: summary.streak.current,
    lastActiveDaysAgo: 0,
    mastery,
    attempts,
  });
  const updated = { ...classroom, studentCount: roster.length };
  educator.classrooms = educator.classrooms.map((candidate) => (candidate.id === classroom.id ? updated : candidate));
  saveEducator();
  return updated;
}

export function classroomMembers(user: User, classroomId: string): ClassroomMember[] {
  const classroom = ownedClassroom(user, classroomId);
  return (educator.rosters[classroom.id] ?? []).map((student) => ({
    classroomId: classroom.id,
    userId: asId(student.id),
    displayName: student.displayName,
    avatarColor: student.avatarColor,
    joinedAt: student.joinedAt,
  }));
}

function bandOf(p: number | undefined, attempts: number | undefined): MasteryBand {
  return p === undefined ? "new" : bandFor(p, attempts ?? 0);
}

function snapshot(student: RosterStudent, skillCount: number, windowDays: number): StudentSnapshot {
  const values = Object.values(student.mastery);
  const masteredSkills = Object.entries(student.mastery).filter(([skillId, p]) => bandOf(p, student.attempts[skillId]) === "mastered").length;
  const struggling = values.filter((p) => p < 0.35).length;
  const inactive = student.lastActiveDaysAgo === null || student.lastActiveDaysAgo >= 5;
  return {
    userId: asId(student.id),
    displayName: student.displayName,
    avatarColor: student.avatarColor,
    minutesThisWeek: Math.round((student.minutesThisWeek * Math.min(windowDays, 7)) / 7),
    streak: student.streak,
    masteredSkills,
    needsAttention: inactive || struggling >= Math.max(2, Math.ceil(skillCount / 3)),
    lastActiveAt: student.lastActiveDaysAgo === null ? null : daysAgo(student.lastActiveDaysAgo).toISOString(),
  };
}

export function classroomInsights(user: User, classroomId: string, range: { from: string; to: string }): ClassroomInsights {
  const classroom = ownedClassroom(user, classroomId);
  const record = courseById(classroom.courseId);
  const skillList = record ? courseSkills(record) : [];
  const roster = educator.rosters[classroom.id] ?? [];
  const windowDays = Math.max(1, Math.round((Date.parse(range.to) - Date.parse(range.from)) / DAY_MS) + 1);

  const distribution: Record<MasteryBand, number> = { new: 0, learning: 0, practicing: 0, mastered: 0 };
  for (const student of roster) {
    for (const skill of skillList) distribution[bandOf(student.mastery[skill.id], student.attempts[skill.id])] += 1;
  }

  const hotspots: SkillHotspot[] = skillList
    .map((skill) => {
      const attempted = roster.filter((student) => student.mastery[skill.id] !== undefined);
      if (attempted.length === 0) return null;
      const meanP = attempted.reduce((sum, student) => sum + (student.mastery[skill.id] ?? 0), 0) / attempted.length;
      // Error rate in the window tracks (1 − mastery), softened by how much practice there was.
      const errorRate = Math.min(0.95, Math.max(0.03, (1 - meanP) * 0.82));
      return {
        skillId: skill.id,
        skillName: skill.name,
        unitTitle: skills.get(skill.id)?.unitTitle ?? "",
        errorRate: Number(errorRate.toFixed(2)),
        studentsStruggling: attempted.filter((student) => (student.mastery[skill.id] ?? 0) < 0.45).length,
        commonMisconception: errorRate > 0.3 ? (MISCONCEPTIONS[skill.code] ?? null) : null,
      };
    })
    .filter((hotspot): hotspot is SkillHotspot => hotspot !== null && hotspot.errorRate >= 0.25)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 5);

  const students = roster.map((student) => snapshot(student, skillList.length, windowDays));
  const totalCells = Math.max(1, roster.length * skillList.length);
  const completionRate = (distribution.practicing + distribution.mastered) / totalCells;
  const averageMinutesPerStudent = students.length === 0 ? 0 : students.reduce((sum, s) => sum + s.minutesThisWeek, 0) / students.length;

  return {
    classroomId: classroom.id,
    generatedAt: new Date().toISOString(),
    window: range,
    completionRate: Number(completionRate.toFixed(3)),
    averageMinutesPerStudent: Math.round(averageMinutesPerStudent),
    masteryDistribution: distribution,
    hotspots,
    students,
  };
}

export function classroomHeatmap(user: User, classroomId: string): MasteryHeatmap {
  const classroom = ownedClassroom(user, classroomId);
  const record = courseById(classroom.courseId);
  const skillList = record ? courseSkills(record) : [];
  const roster = educator.rosters[classroom.id] ?? [];
  return {
    skills: skillList.map((skill) => ({ id: skill.id, name: skill.name })),
    students: roster.map((student) => ({ id: asId(student.id), displayName: student.displayName })),
    cells: roster.flatMap((student) =>
      skillList.map((skill) => {
        const p = student.mastery[skill.id];
        return { userId: asId(student.id), skillId: skill.id, pKnown: p ?? 0, band: bandOf(p, student.attempts[skill.id]) };
      }),
    ),
  };
}

function csvCell(value: string | number | boolean | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function classroomCsv(user: User, classroomId: string): string {
  const classroom = ownedClassroom(user, classroomId);
  const insights = classroomInsights(user, classroomId, { from: dayKey(daysAgo(6)), to: dayKey() });
  const heatmap = classroomHeatmap(user, classroomId);
  const header = ["student", "minutes_this_week", "streak_days", "mastered_skills", "needs_attention", "last_active", ...heatmap.skills.map((skill) => `${skill.name} (p_known)`)];
  const rows = insights.students.map((student) => [
    student.displayName,
    student.minutesThisWeek,
    student.streak,
    student.masteredSkills,
    student.needsAttention,
    student.lastActiveAt ? student.lastActiveAt.slice(0, 10) : null,
    ...heatmap.skills.map((skill) => {
      const cell = heatmap.cells.find((c) => c.userId === student.userId && c.skillId === skill.id);
      return cell && cell.band !== "new" ? cell.pKnown.toFixed(2) : null;
    }),
  ]);
  return [`# ${classroom.name}`, header, ...rows].map((row) => (typeof row === "string" ? row : row.map(csvCell).join(","))).join("\n");
}

/* ------------------------------------------------------------------- sync */

type SyncPushInput = import("@learnly/shared").SyncPushInput;
type SyncResponse = import("@learnly/shared").SyncResponse;
type SyncOpResult = import("@learnly/shared").SyncOpResult;

const appliedOps = new Set<string>();

export function applySync(userId: string, input: SyncPushInput): SyncResponse {
  const results: SyncOpResult[] = input.operations.map((op) => {
    if (appliedOps.has(op.opId)) return { opId: op.opId, status: "duplicate" };
    try {
      if (op.type === "attempt.create") recordAttempt(userId, op.payload);
      else if (op.type === "lesson.complete") completeLesson(userId, op.payload.lessonId, op.payload.durationMs);
      else updatePreferences(userId, op.payload);
      appliedOps.add(op.opId);
      return { opId: op.opId, status: "applied" };
    } catch (error) {
      return { opId: op.opId, status: "rejected", reason: error instanceof Error ? error.message : "Unknown error" };
    }
  });
  const summary = progressSummary(userId);
  return {
    results,
    cursor: String(Date.now()),
    serverTime: new Date().toISOString(),
    mastery: { upserted: Object.values(masteryOf(userId)), deletedIds: [] },
    lessons: { upserted: [], deletedIds: [] },
    progress: { totalXp: summary.totalXp, streak: summary.streak.current, freezesAvailable: summary.streak.freezesAvailable },
  };
}
