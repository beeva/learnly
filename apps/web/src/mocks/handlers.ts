import {
  attemptInputSchema,
  preferencesSchema,
  refreshSchema,
  signInSchema,
  signUpSchema,
  startSessionSchema,
  type PublicItem,
  type User,
} from "@learnly/shared";
import { HttpResponse, delay, http, type PathParams } from "msw";
import type { ZodType, ZodTypeDef } from "zod";
import { courseBySlug, courses, items, lessons, lessonsBySkill } from "./content";
import * as db from "./db";

const API = "*/v1";

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return HttpResponse.json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, { status });
}

interface RouteContext {
  request: Request;
  params: PathParams;
}

/**
 * Wraps a handler with realistic latency and the API's error envelope, so the
 * client exercises exactly the same paths it does against the real server.
 */
function route(handler: (context: RouteContext) => unknown) {
  return async ({ request, params }: RouteContext) => {
    await delay();
    try {
      const result = await handler({ request, params });
      if (result instanceof Response) return result;
      return HttpResponse.json(result as Record<string, unknown>);
    } catch (error) {
      if (error instanceof db.MockHttpError) return errorResponse(error.status, error.code, error.message, error.details);
      console.error("[mock api]", error);
      return errorResponse(500, "internal", "Something went wrong on our side.");
    }
  };
}

function requireUser(request: Request): User {
  const user = db.userFromAuthHeader(request.headers.get("Authorization"));
  if (!user) throw new db.MockHttpError(401, "unauthorized", "Please sign in to continue.");
  return user;
}

function requireRole(user: User, roles: User["role"][]): void {
  if (!roles.includes(user.role)) throw new db.MockHttpError(403, "forbidden", "You don't have access to this.");
}

async function readBody<T>(request: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new db.MockHttpError(400, "validation_failed", "Request body must be JSON.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new db.MockHttpError(400, "validation_failed", "Some fields need another look.", parsed.error.flatten());
  return parsed.data;
}

const param = (params: PathParams, key: string) => String(params[key] ?? "");

export const handlers = [
  http.get("*/healthz", () => HttpResponse.json({ status: "ok" })),

  /* ---------------------------------------------------------------- auth */
  http.post(
    `${API}/auth/sign-up`,
    route(async ({ request }) => {
      const input = await readBody(request, signUpSchema);
      const user = db.signUp(input);
      return HttpResponse.json({ user, ...db.issueTokens(user.id) }, { status: 201 });
    }),
  ),
  http.post(
    `${API}/auth/sign-in`,
    route(async ({ request }) => {
      const input = await readBody(request, signInSchema);
      const user = db.signIn(input.email, input.password);
      return { user, ...db.issueTokens(user.id) };
    }),
  ),
  http.post(
    `${API}/auth/refresh`,
    route(async ({ request }) => {
      const { refreshToken } = await readBody(request, refreshSchema);
      return db.rotateRefreshToken(refreshToken);
    }),
  ),
  http.post(
    `${API}/auth/sign-out`,
    route(async ({ request }) => {
      const { refreshToken } = await readBody(request, refreshSchema);
      db.revokeRefreshToken(refreshToken);
      return new HttpResponse(null, { status: 204 });
    }),
  ),
  http.get(
    `${API}/me`,
    route(({ request }) => {
      const user = requireUser(request);
      return { user, preferences: db.preferencesOf(user.id), progress: db.progressSummary(user.id) };
    }),
  ),
  http.patch(
    `${API}/me/preferences`,
    route(async ({ request }) => {
      const user = requireUser(request);
      const input = await readBody(request, preferencesSchema);
      return { preferences: db.updatePreferences(user.id, input) };
    }),
  ),

  /* ------------------------------------------------------------- catalog */
  http.get(
    `${API}/courses`,
    route(() => ({ courses: courses.map((record) => record.course) })),
  ),
  http.get(
    `${API}/courses/:slug`,
    route(({ params }) => {
      const record = courseBySlug(param(params, "slug"));
      if (!record) throw new db.MockHttpError(404, "not_found", "Course not found.");
      return { course: record.course, units: record.units };
    }),
  ),
  http.get(
    `${API}/skills/:id/lessons`,
    route(({ params }) => {
      const ids = lessonsBySkill.get(param(params, "id")) ?? [];
      return {
        lessons: ids
          .map((id) => lessons.get(id))
          .filter((lesson) => lesson !== undefined)
          .map(({ id, slug, title, level, estimatedMinutes }) => ({ id, slug, title, level, estimatedMinutes })),
      };
    }),
  ),
  http.get(
    `${API}/lessons/:id`,
    route(({ request, params }) => {
      const lesson = lessons.get(param(params, "id"));
      if (!lesson) throw new db.MockHttpError(404, "not_found", "Lesson not found.");
      const user = db.userFromAuthHeader(request.headers.get("Authorization"));
      if (user) db.openLesson(user.id, lesson.id);
      const checkItems: PublicItem[] = lesson.blocks.flatMap((block) => {
        if (block.kind !== "check") return [];
        const item = items.get(block.itemId);
        return item ? [db.toPublicItem(item)] : [];
      });
      return { lesson, items: checkItems };
    }),
  ),

  /* ------------------------------------------------------------ learning */
  http.post(
    `${API}/attempts`,
    route(async ({ request }) => {
      const user = requireUser(request);
      const input = await readBody(request, attemptInputSchema);
      return db.recordAttempt(user.id, input);
    }),
  ),
  http.post(
    `${API}/sessions`,
    route(async ({ request }) => {
      const user = requireUser(request);
      const input = await readBody(request, startSessionSchema);
      return HttpResponse.json(db.startSession(user.id, input), { status: 201 });
    }),
  ),
  http.get(
    `${API}/sessions/:id/next`,
    route(({ request, params }) => db.nextItem(requireUser(request).id, param(params, "id"))),
  ),
  http.post(
    `${API}/sessions/:id/complete`,
    route(({ request, params }) => db.completeSession(requireUser(request).id, param(params, "id"))),
  ),
  http.post(
    `${API}/lessons/:id/complete`,
    route(async ({ request, params }) => {
      const user = requireUser(request);
      const body = (await request.json().catch(() => ({}))) as { durationMs?: unknown };
      const durationMs = typeof body.durationMs === "number" && body.durationMs >= 0 ? body.durationMs : 0;
      return db.completeLesson(user.id, param(params, "id"), durationMs);
    }),
  ),

  /* ------------------------------------------------------------ progress */
  http.get(
    `${API}/progress`,
    route(({ request }) => db.progressResponse(requireUser(request).id)),
  ),
  http.get(
    `${API}/courses/:slug/mastery`,
    route(({ request, params }) => {
      const user = requireUser(request);
      const record = courseBySlug(param(params, "slug"));
      if (!record) throw new db.MockHttpError(404, "not_found", "Course not found.");
      return { mastery: db.courseMastery(user.id, record.course.id) };
    }),
  ),
  http.get(
    `${API}/recommendations`,
    route(({ request }) => ({ next: db.recommendations(requireUser(request).id) })),
  ),
];

type JoinInput = { joinCode: string };

handlers.push(
  http.get("*/readyz", () => HttpResponse.json({ status: "ok", db: "mock" })),

  http.get(
    `${API}/classrooms`,
    route(({ request }) => ({ classrooms: db.classroomsFor(requireUser(request)) })),
  ),
  http.post(
    `${API}/classrooms`,
    route(async ({ request }) => {
      const user = requireUser(request);
      requireRole(user, ["educator", "admin"]);
      const { createClassroomSchema } = await import("@learnly/shared");
      const input = await readBody(request, createClassroomSchema);
      return HttpResponse.json({ classroom: db.createClassroom(user, input) }, { status: 201 });
    }),
  ),
  http.post(
    `${API}/classrooms/join`,
    route(async ({ request }) => {
      const user = requireUser(request);
      requireRole(user, ["student"]);
      const { joinClassroomSchema } = await import("@learnly/shared");
      const input: JoinInput = await readBody(request, joinClassroomSchema);
      return { classroom: db.joinClassroom(user, input.joinCode) };
    }),
  ),
  http.get(
    `${API}/classrooms/:id/members`,
    route(({ request, params }) => {
      const user = requireUser(request);
      requireRole(user, ["educator", "admin"]);
      return { members: db.classroomMembers(user, param(params, "id")) };
    }),
  ),
  http.get(
    `${API}/classrooms/:id/insights`,
    route(({ request, params }) => {
      const user = requireUser(request);
      requireRole(user, ["educator", "admin"]);
      const url = new URL(request.url);
      const to = url.searchParams.get("to") ?? db.dayKey();
      const from = url.searchParams.get("from") ?? db.dayKey(new Date(Date.parse(to) - 6 * 86_400_000));
      return db.classroomInsights(user, param(params, "id"), { from, to });
    }),
  ),
  http.get(
    `${API}/classrooms/:id/heatmap`,
    route(({ request, params }) => {
      const user = requireUser(request);
      requireRole(user, ["educator", "admin"]);
      return db.classroomHeatmap(user, param(params, "id"));
    }),
  ),
  http.get(
    `${API}/classrooms/:id/export.csv`,
    route(({ request, params }) => {
      const user = requireUser(request);
      requireRole(user, ["educator", "admin"]);
      return new HttpResponse(db.classroomCsv(user, param(params, "id")), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="classroom.csv"' },
      });
    }),
  ),

  http.post(
    `${API}/sync`,
    route(async ({ request }) => {
      const user = requireUser(request);
      const { syncPushSchema } = await import("@learnly/shared");
      const input = await readBody(request, syncPushSchema);
      return db.applySync(user.id, input);
    }),
  ),

  http.post(
    `${API}/events`,
    route(async ({ request }) => {
      const body = (await request.json().catch(() => null)) as { events?: unknown[] } | null;
      if (!body || !Array.isArray(body.events)) throw new db.MockHttpError(400, "validation_failed", "Expected an events array.");
      if (import.meta.env.DEV) console.debug(`[mock api] received ${body.events.length} analytics event(s)`, body.events);
      return new HttpResponse(null, { status: 202 });
    }),
  ),
);
