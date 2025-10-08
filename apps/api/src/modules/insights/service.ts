import type {
  Classroom,
  ClassroomInsights,
  Item,
  ItemId,
  MasteryHeatmap,
  MasteryHeatmapCell,
  UserId,
} from "@learnly/shared";
import type { Clock } from "../../lib/clock.js";
import { toCsv } from "../../lib/csv.js";
import { addDays, utcDay } from "../../lib/dates.js";
import type { CatalogRepository } from "../catalog/repository.js";
import type { ClassroomRepository } from "../classrooms/repository.js";
import { displayedStreak } from "../progress/service.js";
import { masteryDistribution, skillHotspots, studentSnapshot, type InsightAttempt, type SkillInfo } from "./compute.js";
import type { InsightsRepository, UserMastery } from "./repository.js";

export interface InsightsWindow {
  from: string;
  to: string;
}

export interface InsightsServiceDeps {
  insights: InsightsRepository;
  catalog: CatalogRepository;
  classrooms: ClassroomRepository;
  clock: Clock;
}

function groupBy<T, K>(values: T[], key: (value: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const value of values) {
    const k = key(value);
    const list = groups.get(k) ?? [];
    list.push(value);
    groups.set(k, list);
  }
  return groups;
}

export class InsightsService {
  constructor(private readonly deps: InsightsServiceDeps) {}

  private async courseSkills(classroom: Classroom): Promise<SkillInfo[]> {
    const units = await this.deps.catalog.listUnits(classroom.courseId);
    return units.flatMap((unit) => unit.skills.map((skill) => ({ id: skill.id, name: skill.name, unitTitle: unit.title })));
  }

  async insights(classroom: Classroom, window: InsightsWindow): Promise<ClassroomInsights> {
    const now = this.deps.clock.now();
    const [members, skills] = await Promise.all([this.deps.classrooms.members(classroom.id), this.courseSkills(classroom)]);
    const userIds = members.map((member) => member.userId);
    const skillIds = skills.map((skill) => skill.id);
    const toDay = utcDay(window.to);
    const weekStart = addDays(toDay, -6);

    const [attempts, mastery, windowMinutes, weekMinutes, streaks, lastActive, completed, lessonCount] = await Promise.all([
      this.deps.insights.attempts(userIds, skillIds, window.from, window.to),
      this.deps.insights.mastery(userIds, skillIds),
      this.deps.insights.minutes(userIds, utcDay(window.from), toDay),
      this.deps.insights.minutes(userIds, weekStart, toDay),
      this.deps.insights.streaks(userIds),
      this.deps.insights.lastActive(userIds),
      this.deps.insights.completedLessons(userIds, classroom.courseId),
      this.deps.insights.lessonCount(classroom.courseId),
    ]);

    const items = await this.itemsFor(attempts);
    const attemptsByUser = groupBy(attempts, (attempt) => attempt.userId);
    const masteryByUser = groupBy(mastery, (m) => m.userId);
    const today = utcDay(now);

    const students = members.map((member) => {
      const streak = streaks.get(member.userId);
      return studentSnapshot({
        userId: member.userId,
        displayName: member.displayName,
        avatarColor: member.avatarColor,
        minutesThisWeek: weekMinutes.get(member.userId) ?? 0,
        streak: streak ? displayedStreak(streak, today).current : 0,
        lastActiveAt: lastActive.get(member.userId) ?? null,
        attempts: attemptsByUser.get(member.userId) ?? [],
        mastery: masteryByUser.get(member.userId) ?? [],
        now,
      });
    });

    const totalMinutes = [...windowMinutes.values()].reduce((sum, minutes) => sum + minutes, 0);
    const completionRate =
      members.length === 0 || lessonCount === 0
        ? 0
        : members.reduce((sum, member) => sum + Math.min(1, (completed.get(member.userId) ?? 0) / lessonCount), 0) /
          members.length;

    return {
      classroomId: classroom.id,
      generatedAt: now.toISOString(),
      window: { from: window.from, to: window.to },
      completionRate,
      averageMinutesPerStudent: members.length === 0 ? 0 : Math.round((totalMinutes / members.length) * 10) / 10,
      masteryDistribution: masteryDistribution(members.length, skills.length, mastery),
      hotspots: skillHotspots(attempts, skills, items),
      // Students who need a check-in first, then alphabetical.
      students: students.sort(
        (a, b) => Number(b.needsAttention) - Number(a.needsAttention) || a.displayName.localeCompare(b.displayName),
      ),
    };
  }

  private async itemsFor(attempts: InsightAttempt[]): Promise<Map<ItemId, Item>> {
    const wrongItemIds = [...new Set(attempts.filter((a) => !a.correct).map((a) => a.itemId))];
    const items = await this.deps.catalog.findItems(wrongItemIds);
    return new Map(items.map((item) => [item.id, item]));
  }

  async heatmap(classroom: Classroom): Promise<MasteryHeatmap> {
    const [members, skills] = await Promise.all([this.deps.classrooms.members(classroom.id), this.courseSkills(classroom)]);
    const mastery = await this.deps.insights.mastery(
      members.map((member) => member.userId),
      skills.map((skill) => skill.id),
    );
    const stored = new Map(mastery.map((m) => [`${m.userId}:${m.skillId}`, m]));
    const cells: MasteryHeatmapCell[] = members.flatMap((member) =>
      skills.map((skill): MasteryHeatmapCell => {
        const m: UserMastery | undefined = stored.get(`${member.userId}:${skill.id}`);
        return { userId: member.userId, skillId: skill.id, pKnown: m?.pKnown ?? 0, band: m?.band ?? "new" };
      }),
    );
    return {
      skills: skills.map((skill) => ({ id: skill.id, name: skill.name })),
      students: members.map((member) => ({ id: member.userId, displayName: member.displayName })),
      cells,
    };
  }

  /** One row per student: the weekly snapshot plus mastery (%) for every skill. */
  async exportCsv(classroom: Classroom): Promise<string> {
    const to = this.deps.clock.now();
    const from = new Date(to.getTime() - 7 * 86_400_000);
    const [insights, heatmap] = await Promise.all([
      this.insights(classroom, { from: from.toISOString(), to: to.toISOString() }),
      this.heatmap(classroom),
    ]);
    const cellsByStudent = groupBy(heatmap.cells, (cell) => cell.userId);
    const header = [
      "Student",
      "Minutes this week",
      "Streak (days)",
      "Skills mastered",
      "Needs attention",
      "Last active",
      ...heatmap.skills.map((skill) => `${skill.name} (% known)`),
    ];
    const rows = insights.students
      .slice()
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map((student) => {
        const cells = new Map((cellsByStudent.get(student.userId as UserId) ?? []).map((cell) => [cell.skillId, cell]));
        return [
          student.displayName,
          student.minutesThisWeek,
          student.streak,
          student.masteredSkills,
          student.needsAttention ? "yes" : "no",
          student.lastActiveAt ?? "",
          ...heatmap.skills.map((skill) => Math.round((cells.get(skill.id)?.pKnown ?? 0) * 100)),
        ];
      });
    return toCsv(header, rows);
  }
}
