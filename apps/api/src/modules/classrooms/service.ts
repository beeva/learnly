import { randomInt } from "node:crypto";
import type { Classroom, ClassroomId, ClassroomMember, CourseId } from "@learnly/shared";
import { forbidden, internal, notFound } from "../../lib/errors.js";
import type { AuthContext } from "../../lib/http.js";
import type { AuditService } from "../audit/service.js";
import type { CatalogRepository } from "../catalog/repository.js";
import type { ClassroomRepository } from "./repository.js";

/** No 0/O or 1/I: codes get read aloud and copied off a whiteboard. */
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(pick: (max: number) => number = randomInt): string {
  return Array.from({ length: 6 }, () => JOIN_CODE_ALPHABET[pick(JOIN_CODE_ALPHABET.length)] ?? "A").join("");
}

export interface ClassroomServiceDeps {
  classrooms: ClassroomRepository;
  catalog: CatalogRepository;
  audit: AuditService;
  pickCode?: (max: number) => number;
}

export class ClassroomService {
  constructor(private readonly deps: ClassroomServiceDeps) {}

  list(auth: AuthContext): Promise<Classroom[]> {
    switch (auth.role) {
      case "admin":
        return this.deps.classrooms.listAll();
      case "educator":
        return this.deps.classrooms.listForEducator(auth.userId);
      case "student":
        return this.deps.classrooms.listForStudent(auth.userId);
    }
  }

  async create(auth: AuthContext, input: { name: string; courseId: string }): Promise<Classroom> {
    const course = await this.deps.catalog.findCourseById(input.courseId as CourseId);
    if (!course) throw notFound("course");
    // 32^6 ≈ 1 billion codes; a handful of retries makes a collision practically impossible.
    for (let attempt = 0; attempt < 5; attempt++) {
      const classroom = await this.deps.classrooms.create({
        name: input.name,
        educatorId: auth.userId,
        courseId: course.id,
        joinCode: generateJoinCode(this.deps.pickCode),
      });
      if (classroom) {
        await this.deps.audit.record({
          action: "classroom.create",
          actorId: auth.userId,
          targetType: "classroom",
          targetId: classroom.id,
          metadata: { courseId: course.id },
        });
        return classroom;
      }
    }
    throw internal("We couldn't create a join code. Please try again.");
  }

  async join(auth: AuthContext, joinCode: string): Promise<Classroom> {
    if (auth.role !== "student") throw forbidden("Only learners can join a classroom with a code.");
    const classroom = await this.deps.classrooms.findByJoinCode(joinCode);
    if (!classroom) throw notFound("classroom — double-check the code with your teacher");
    const added = await this.deps.classrooms.addMember(classroom.id, auth.userId);
    if (added) {
      await this.deps.audit.record({
        action: "classroom.join",
        actorId: auth.userId,
        targetType: "classroom",
        targetId: classroom.id,
      });
    }
    return (await this.deps.classrooms.findById(classroom.id)) ?? classroom;
  }

  /**
   * Classroom data is student data: only the classroom's own educator (or an admin) can
   * see it. Anyone else gets a 404, so ids can't be probed.
   */
  async viewable(auth: AuthContext, id: ClassroomId): Promise<Classroom> {
    const classroom = await this.deps.classrooms.findById(id);
    if (!classroom) throw notFound("classroom");
    if (auth.role !== "admin" && classroom.educatorId !== auth.userId) throw notFound("classroom");
    return classroom;
  }

  async members(auth: AuthContext, id: ClassroomId): Promise<ClassroomMember[]> {
    const classroom = await this.viewable(auth, id);
    return this.deps.classrooms.members(classroom.id);
  }
}
