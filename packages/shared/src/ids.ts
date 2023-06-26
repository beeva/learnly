declare const brand: unique symbol;

/** Nominal typing helper: a string that is tagged with the entity it identifies. */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, "UserId">;
export type CourseId = Brand<string, "CourseId">;
export type UnitId = Brand<string, "UnitId">;
export type SkillId = Brand<string, "SkillId">;
export type LessonId = Brand<string, "LessonId">;
export type ItemId = Brand<string, "ItemId">;
export type AttemptId = Brand<string, "AttemptId">;
export type SessionId = Brand<string, "SessionId">;
export type ClassroomId = Brand<string, "ClassroomId">;
export type DeviceId = Brand<string, "DeviceId">;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Cast a trusted string (e.g. from the database) into a branded id. */
export function asId<T extends Brand<string, string>>(value: string): T {
  return value as T;
}
