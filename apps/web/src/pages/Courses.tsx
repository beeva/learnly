import type { Course, Skill, Subject, Unit } from "@learnly/shared";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useId, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { api, isApiError, queryKeys } from "../api/client";
import { Badge, Button, ButtonLink, Card, EmptyState, Input, Skeleton, cx } from "../ui/components";
import {
  AlertIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BookIcon,
  ChevronDownIcon,
  ClockIcon,
  CompassIcon,
  LayersIcon,
  PlayIcon,
  RefreshIcon,
  SearchIcon,
  SparklesIcon,
  TargetIcon,
} from "../ui/icons";
import { GRADE_BAND_LABEL } from "./Auth";
import styles from "./Courses.module.css";

export const SUBJECT_LABEL: Record<Subject, string> = { math: "Math", reading: "Reading", science: "Science" };

const SUBJECT_GLYPHS: Record<Subject, string[]> = {
  math: ["½", "+", "×", "¾", "=", "÷"],
  reading: ["A", "b", "“", "?", "c", "!"],
  science: ["●", "○", "◆", "◇", "●", "○"],
};

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Generative cover art: a hue-tinted gradient with floating subject glyphs. */
export function CourseCover({ course, size = "md" }: { course: Pick<Course, "subject" | "coverHue" | "title">; size?: "sm" | "md" | "lg" }) {
  const glyphs = SUBJECT_GLYPHS[course.subject];
  return (
    <div className={cx(styles.cover, styles[`cover-${size}`])} style={{ "--hue": course.coverHue } as CSSProperties} aria-hidden="true">
      {glyphs.map((glyph, index) => (
        <span key={index} className={styles.glyph} style={{ "--i": index } as CSSProperties}>
          {glyph}
        </span>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- catalog */

type SubjectFilter = Subject | "all";

function CourseCard({ course }: { course: Course }) {
  return (
    <Card as="article" padding="none" interactive className={styles.courseCard}>
      <CourseCover course={course} />
      <div className={styles.courseBody}>
        <div className={styles.courseMeta}>
          <Badge tone="primary" size="sm">
            {SUBJECT_LABEL[course.subject]}
          </Badge>
          <Badge size="sm">{GRADE_BAND_LABEL[course.gradeBand]}</Badge>
        </div>
        <h2 className={styles.courseTitle}>
          <Link to={`/courses/${course.slug}`} className={styles.courseLink}>
            {course.title}
          </Link>
        </h2>
        <p className={styles.courseDescription}>{course.description}</p>
        <div className={styles.courseFooter}>
          <span>
            <LayersIcon size={16} /> {course.unitCount} units
          </span>
          <span>
            <ClockIcon size={16} /> {formatMinutes(course.estimatedMinutes)}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function CatalogPage() {
  const { data, isPending, isError, refetch, isRefetching } = useQuery({ queryKey: queryKeys.courses, queryFn: api.courses, staleTime: 10 * 60_000 });
  const [subject, setSubject] = useState<SubjectFilter>("all");
  const [search, setSearch] = useState("");

  const courses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.courses ?? []).filter(
      (course) =>
        (subject === "all" || course.subject === subject) &&
        (!term || course.title.toLowerCase().includes(term) || course.description.toLowerCase().includes(term)),
    );
  }, [data, subject, search]);

  return (
    <div className={styles.page}>
      <header className="page-header">
        <div>
          <p className="eyebrow">Explore</p>
          <h1>Courses</h1>
          <p>Short, focused courses that adapt as you go. Pick one to see its units and skills.</p>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Filter by subject">
          {(["all", "math", "reading", "science"] as const).map((value) => (
            <button key={value} type="button" className={cx(styles.filter, subject === value && styles.filterActive)} aria-pressed={subject === value} onClick={() => setSubject(value)}>
              {value === "all" ? "All subjects" : SUBJECT_LABEL[value]}
            </button>
          ))}
        </div>
        <Input
          className={styles.search}
          type="search"
          placeholder="Search courses"
          aria-label="Search courses"
          leadingIcon={SearchIcon}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {isPending ? (
        <ul role="list" className={styles.grid} aria-busy="true" aria-label="Loading courses">
          {Array.from({ length: 6 }, (_, i) => (
            <Card as="li" padding="none" key={i} className={styles.courseCard}>
              <Skeleton height={140} radius={0} />
              <div className={styles.courseBody}>
                <Skeleton width={120} height={20} />
                <Skeleton height={24} />
                <Skeleton lines={2} />
              </div>
            </Card>
          ))}
        </ul>
      ) : isError ? (
        <EmptyState
          icon={AlertIcon}
          title="We couldn't load courses"
          description="This is usually a connection hiccup. Give it another try."
          action={
            <Button variant="secondary" leadingIcon={RefreshIcon} loading={isRefetching} onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="No courses match"
          description="Try a different subject or a shorter search."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSubject("all");
                setSearch("");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul role="list" className={styles.grid}>
          <AnimatePresence initial={false}>
            {courses.map((course, index) => (
              <motion.li key={course.id} className={styles.gridItem} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: index * 0.03 }}>
                <CourseCard course={course} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- course detail */

function SkillLessons({ skill, courseSlug }: { skill: Skill; courseSlug: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.skillLessons(skill.id),
    queryFn: () => api.skillLessons(skill.id),
    staleTime: 10 * 60_000,
  });
  if (isPending) return <Skeleton lines={2} height={14} />;
  if (isError) return <p className={styles.muted}>Lessons are unavailable right now.</p>;
  if (data.lessons.length === 0) return <p className={styles.muted}>Lessons for this skill are on the way.</p>;
  return (
    <ul role="list" className={styles.lessonList}>
      {data.lessons.map((lesson) => (
        <li key={lesson.id}>
          <Link to={`/lessons/${lesson.id}?course=${encodeURIComponent(courseSlug)}`} className={styles.lessonLink}>
            <span className={styles.lessonPlay}>
              <PlayIcon size={14} />
            </span>
            <span className={styles.lessonTitle}>{lesson.title}</span>
            <span className={styles.lessonMeta}>
              Level {lesson.level} · {lesson.estimatedMinutes} min
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SkillNode({ skill, skillNames, courseSlug }: { skill: Skill; skillNames: Map<string, string>; courseSlug: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const prerequisites = skill.prerequisiteIds.map((id) => skillNames.get(id)).filter((name): name is string => Boolean(name));
  return (
    <li className={cx(styles.skill, open && styles.skillOpen)}>
      <button type="button" className={styles.skillButton} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
        <span className={styles.skillDot} aria-hidden="true" />
        <span className={styles.skillText}>
          <span className={styles.skillName}>{skill.name}</span>
          {prerequisites.length > 0 ? <span className={styles.skillPrereq}>Builds on {prerequisites.join(", ")}</span> : null}
        </span>
        <span className={styles.skillCode}>{skill.code}</span>
        <ChevronDownIcon size={18} className={styles.skillChevron} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            className={styles.skillPanel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.skillPanelInner}>
              <SkillLessons skill={skill} courseSlug={courseSlug} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

function UnitCard({ unit, skillNames, courseSlug, index }: { unit: Unit; skillNames: Map<string, string>; courseSlug: string; index: number }) {
  return (
    <motion.li
      className={styles.unit}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: Math.min(index, 4) * 0.06, duration: 0.4 }}
    >
      <div className={styles.unitRail} aria-hidden="true">
        <span className={styles.unitNumber}>{unit.position}</span>
      </div>
      <Card className={styles.unitCard}>
        <p className="eyebrow">Unit {unit.position}</p>
        <h3 className={styles.unitTitle}>{unit.title}</h3>
        <p className={styles.unitSummary}>{unit.summary}</p>
        <ul role="list" className={styles.skills} aria-label={`Skills in ${unit.title}`}>
          {unit.skills.map((skill) => (
            <SkillNode key={skill.id} skill={skill} skillNames={skillNames} courseSlug={courseSlug} />
          ))}
        </ul>
      </Card>
    </motion.li>
  );
}

export function CourseDetailPage() {
  const { slug = "" } = useParams();
  const { data, isPending, error, refetch } = useQuery({ queryKey: queryKeys.course(slug), queryFn: () => api.course(slug), staleTime: 10 * 60_000 });

  const skillNames = useMemo(() => new Map((data?.units ?? []).flatMap((unit) => unit.skills.map((skill) => [skill.id as string, skill.name]))), [data]);
  const skillCount = skillNames.size;

  if (isPending) {
    return (
      <div className={styles.page} aria-busy="true" aria-label="Loading course">
        <Skeleton height={220} radius={20} />
        <div style={{ marginTop: 32, display: "grid", gap: 16 }}>
          <Skeleton height={140} radius={20} />
          <Skeleton height={140} radius={20} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    const missing = isApiError(error, "not_found");
    return (
      <EmptyState
        icon={missing ? CompassIcon : AlertIcon}
        title={missing ? "We couldn't find that course" : "This course didn't load"}
        description={missing ? "It may have moved. Browse all courses to find it." : "Check your connection and try again."}
        action={
          missing ? (
            <ButtonLink to="/courses" variant="secondary" leadingIcon={ArrowLeftIcon}>
              All courses
            </ButtonLink>
          ) : (
            <Button variant="secondary" leadingIcon={RefreshIcon} onClick={() => void refetch()}>
              Try again
            </Button>
          )
        }
      />
    );
  }

  const { course, units } = data;

  return (
    <div className={styles.page}>
      <Link to="/courses" className={styles.back}>
        <ArrowLeftIcon size={16} /> All courses
      </Link>

      <section className={styles.hero} style={{ "--hue": course.coverHue } as CSSProperties}>
        <CourseCover course={course} size="lg" />
        <div className={styles.heroContent}>
          <div className={styles.courseMeta}>
            <Badge size="sm">{SUBJECT_LABEL[course.subject]}</Badge>
            <Badge size="sm">{GRADE_BAND_LABEL[course.gradeBand]}</Badge>
          </div>
          <h1 className={styles.heroTitle}>{course.title}</h1>
          <p className={styles.heroDescription}>{course.description}</p>
          <dl className={styles.stats}>
            <div>
              <dt>Units</dt>
              <dd>{units.length}</dd>
            </div>
            <div>
              <dt>Skills</dt>
              <dd>{skillCount}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{formatMinutes(course.estimatedMinutes)}</dd>
            </div>
          </dl>
          <div className={styles.heroCtas}>
            <ButtonLink to={`/assess/${course.slug}`} variant="accent" leadingIcon={CompassIcon}>
              Find my starting point
            </ButtonLink>
            <ButtonLink to={`/practice/${course.slug}`} variant="secondary" leadingIcon={TargetIcon} trailingIcon={ArrowRightIcon}>
              Practice
            </ButtonLink>
          </div>
        </div>
      </section>

      <section aria-labelledby="map-title" className={styles.mapSection}>
        <div className={styles.mapHeader}>
          <h2 id="map-title">
            <SparklesIcon size={22} /> Skills map
          </h2>
          <p className="muted">Each unit builds on the last. Open a skill to see its lessons.</p>
        </div>
        {units.length === 0 ? (
          <EmptyState compact icon={BookIcon} title="Units are being written" description="Check back soon — new lessons land every week." />
        ) : (
          <ol role="list" className={styles.units}>
            {units
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((unit, index) => (
                <UnitCard key={unit.id} unit={unit} skillNames={skillNames} courseSlug={course.slug} index={index} />
              ))}
          </ol>
        )}
      </section>
    </div>
  );
}
