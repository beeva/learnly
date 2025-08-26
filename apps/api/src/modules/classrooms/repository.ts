import type { Classroom, ClassroomId, ClassroomMember, CourseId, UserId } from "@learnly/shared";
import { isUniqueViolation, toIso, type Database } from "../../db/sql.js";

export interface NewClassroom {
  name: string;
  educatorId: UserId;
  courseId: CourseId;
  joinCode: string;
}

export interface ClassroomRepository {
  /** Returns null if the join code is already taken (the caller retries with a new one). */
  create(input: NewClassroom): Promise<Classroom | null>;
  findById(id: ClassroomId): Promise<Classroom | null>;
  findByJoinCode(joinCode: string): Promise<Classroom | null>;
  listForEducator(educatorId: UserId): Promise<Classroom[]>;
  listForStudent(userId: UserId): Promise<Classroom[]>;
  listAll(): Promise<Classroom[]>;
  /** Idempotent. Returns false if the learner was already a member. */
  addMember(classroomId: ClassroomId, userId: UserId): Promise<boolean>;
  members(classroomId: ClassroomId): Promise<ClassroomMember[]>;
}

interface ClassroomRow {
  id: ClassroomId;
  name: string;
  educator_id: UserId;
  course_id: CourseId;
  join_code: string;
  student_count: number;
  created_at: Date;
}

const SELECT = `
  select c.id, c.name, c.educator_id, c.course_id, c.join_code, c.created_at,
         (select count(*) from classroom_members m where m.classroom_id = c.id)::int as student_count
    from classrooms c`;

function toClassroom(row: ClassroomRow): Classroom {
  return {
    id: row.id,
    name: row.name,
    educatorId: row.educator_id,
    courseId: row.course_id,
    joinCode: row.join_code,
    studentCount: row.student_count,
    createdAt: toIso(row.created_at),
  };
}

export class PgClassroomRepository implements ClassroomRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewClassroom): Promise<Classroom | null> {
    try {
      const row = await this.db.one<{ id: ClassroomId }>(
        `insert into classrooms (name, educator_id, course_id, join_code) values ($1, $2, $3, $4) returning id`,
        [input.name, input.educatorId, input.courseId, input.joinCode],
      );
      return this.findById(row.id);
    } catch (error) {
      if (isUniqueViolation(error, "classrooms_join_code_key")) return null;
      throw error;
    }
  }

  async findById(id: ClassroomId): Promise<Classroom | null> {
    const row = await this.db.maybeOne<ClassroomRow>(`${SELECT} where c.id = $1 and c.archived_at is null`, [id]);
    return row ? toClassroom(row) : null;
  }

  async findByJoinCode(joinCode: string): Promise<Classroom | null> {
    const row = await this.db.maybeOne<ClassroomRow>(`${SELECT} where c.join_code = $1 and c.archived_at is null`, [
      joinCode,
    ]);
    return row ? toClassroom(row) : null;
  }

  async listForEducator(educatorId: UserId): Promise<Classroom[]> {
    const rows = await this.db.query<ClassroomRow>(
      `${SELECT} where c.educator_id = $1 and c.archived_at is null order by c.created_at desc`,
      [educatorId],
    );
    return rows.map(toClassroom);
  }

  async listForStudent(userId: UserId): Promise<Classroom[]> {
    const rows = await this.db.query<ClassroomRow>(
      `${SELECT}
        join classroom_members cm on cm.classroom_id = c.id
       where cm.user_id = $1 and c.archived_at is null
       order by cm.joined_at desc`,
      [userId],
    );
    return rows.map(toClassroom);
  }

  async listAll(): Promise<Classroom[]> {
    const rows = await this.db.query<ClassroomRow>(`${SELECT} where c.archived_at is null order by c.created_at desc`);
    return rows.map(toClassroom);
  }

  async addMember(classroomId: ClassroomId, userId: UserId): Promise<boolean> {
    const rows = await this.db.query(
      `insert into classroom_members (classroom_id, user_id) values ($1, $2)
       on conflict do nothing returning user_id`,
      [classroomId, userId],
    );
    return rows.length === 1;
  }

  async members(classroomId: ClassroomId): Promise<ClassroomMember[]> {
    const rows = await this.db.query<{
      classroom_id: ClassroomId;
      user_id: UserId;
      display_name: string;
      avatar_color: string;
      joined_at: Date;
    }>(
      `select m.classroom_id, m.user_id, u.display_name, u.avatar_color, m.joined_at
         from classroom_members m
         join users u on u.id = m.user_id
        where m.classroom_id = $1
        order by u.display_name`,
      [classroomId],
    );
    return rows.map((row) => ({
      classroomId: row.classroom_id,
      userId: row.user_id,
      displayName: row.display_name,
      avatarColor: row.avatar_color,
      joinedAt: toIso(row.joined_at),
    }));
  }
}
