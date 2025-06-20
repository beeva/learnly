import type { Classroom, Course } from "@learnly/shared";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useClassrooms, useCourses } from "../../api/hooks";
import { useT } from "../../i18n/I18nProvider";
import { CourseCover } from "../../pages/Courses";
import { Badge, Button, Card, EmptyState, IconButton, Skeleton, useToast } from "../../ui/components";
import { AlertIcon, ArrowRightIcon, CheckIcon, CopyIcon, GraduationCapIcon, PlusIcon, RefreshIcon, UsersIcon } from "../../ui/icons";
import { CreateClassroomDialog } from "./CreateClassroomDialog";
import styles from "./Classrooms.module.css";

/** Copy a join code and confirm it out loud (toast + live region in the toaster). */
export function useCopyJoinCode() {
  const { t } = useT();
  const { toast } = useToast();
  return async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ tone: "success", icon: CheckIcon, title: t("educator.code.copied", { code }) });
    } catch {
      toast({ tone: "warning", title: t("educator.code.copyFailed", { code }) });
    }
  };
}

export function JoinCodeChip({ code }: { code: string }) {
  const { t } = useT();
  const copy = useCopyJoinCode();
  return (
    <span className={styles.codeChip}>
      <span className={styles.codeLabel}>{t("educator.code.label")}</span>
      <span className={styles.code} aria-label={code.split("").join(" ")}>
        {code}
      </span>
      <IconButton icon={CopyIcon} size="sm" label={t("educator.code.copy", { code })} onClick={() => void copy(code)} />
    </span>
  );
}

function ClassroomCard({ classroom, course, index }: { classroom: Classroom; course: Course | undefined; index: number }) {
  const { t } = useT();
  return (
    <motion.li
      className={styles.gridItem}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card padding="none" interactive className={styles.card}>
        {course ? <CourseCover course={course} size="sm" /> : <div className={styles.coverFallback} aria-hidden="true" />}
        <div className={styles.cardBody}>
          <div className={styles.cardMeta}>
            {course ? (
              <Badge size="sm" tone="primary">
                {course.title}
              </Badge>
            ) : null}
          </div>
          <h2 className={styles.cardTitle}>
            <Link to={`/teach/${classroom.id}`} className={styles.cardLink}>
              {classroom.name}
            </Link>
          </h2>
          <p className={styles.students}>
            <UsersIcon size={16} />
            {classroom.studentCount === 0 ? t("educator.card.noStudents") : t("educator.card.students", { count: classroom.studentCount })}
          </p>
          <div className={styles.cardFooter}>
            <JoinCodeChip code={classroom.joinCode} />
            <span className={styles.open} aria-hidden="true">
              {t("educator.card.insights")} <ArrowRightIcon size={16} />
            </span>
          </div>
        </div>
      </Card>
    </motion.li>
  );
}

export function ClassroomsPage() {
  const { t } = useT();
  const classrooms = useClassrooms();
  const courses = useCourses();
  const [creating, setCreating] = useState(false);
  const courseById = useMemo(() => new Map((courses.data?.courses ?? []).map((course) => [course.id as string, course])), [courses.data]);

  const list = classrooms.data?.classrooms ?? [];
  const totalStudents = list.reduce((sum, classroom) => sum + classroom.studentCount, 0);

  return (
    <div>
      <header className="page-header">
        <div>
          <p className="eyebrow">{t("educator.eyebrow")}</p>
          <h1>{t("educator.title")}</h1>
          <p>{list.length > 0 ? t("educator.summary", { classes: list.length, students: totalStudents }) : t("educator.subtitle")}</p>
        </div>
        <Button leadingIcon={PlusIcon} onClick={() => setCreating(true)}>
          {t("educator.new")}
        </Button>
      </header>

      {classrooms.isPending ? (
        <ul role="list" className={styles.grid} aria-busy="true" aria-label={t("common.loading")}>
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className={styles.gridItem}>
              <Card padding="none" className={styles.card}>
                <Skeleton height={72} radius={0} />
                <div className={styles.cardBody}>
                  <Skeleton width={110} height={20} />
                  <Skeleton height={26} />
                  <Skeleton width={140} height={16} />
                  <Skeleton height={40} radius={12} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : classrooms.isError ? (
        <EmptyState
          icon={AlertIcon}
          title={t("educator.error.title")}
          description={t("educator.error.body")}
          action={
            <Button variant="secondary" leadingIcon={RefreshIcon} loading={classrooms.isRefetching} onClick={() => void classrooms.refetch()}>
              {t("common.retry")}
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <Card padding="none" className={styles.emptyCard}>
          <EmptyState
            icon={GraduationCapIcon}
            title={t("educator.empty.title")}
            description={t("educator.empty.body")}
            action={
              <Button leadingIcon={PlusIcon} onClick={() => setCreating(true)}>
                {t("educator.empty.cta")}
              </Button>
            }
          />
          <ol className={styles.steps}>
            <li>{t("educator.empty.step1")}</li>
            <li>{t("educator.empty.step2")}</li>
            <li>{t("educator.empty.step3")}</li>
          </ol>
        </Card>
      ) : (
        <ul role="list" className={styles.grid}>
          {list.map((classroom, index) => (
            <ClassroomCard key={classroom.id} classroom={classroom} course={courseById.get(classroom.courseId)} index={index} />
          ))}
        </ul>
      )}

      <CreateClassroomDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
