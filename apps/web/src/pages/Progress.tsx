import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useCourse, useCourseMastery, useCourses, useProgress } from "../api/hooks";
import { MasteryMap } from "../features/progress/MasteryMap";
import { StreakFlame } from "../features/progress/StreakFlame";
import { WeeklyActivity } from "../features/progress/WeeklyActivity";
import styles from "../features/progress/progress.module.css";
import { useT } from "../i18n/I18nProvider";
import { Button, Card, EmptyState, ProgressRing, Skeleton, cx } from "../ui/components";
import { AlertIcon, RefreshIcon, StarIcon } from "../ui/icons";

export function ProgressPage() {
  const { t, formatNumber } = useT();
  const progress = useProgress();
  const courses = useCourses();
  const [params, setParams] = useSearchParams();

  // Default to the first course; the choice is kept in the URL so it survives reloads.
  const defaultSlug = useMemo(() => {
    const list = courses.data?.courses ?? [];
    return list[0]?.slug ?? null;
  }, [courses.data]);
  const selected = params.get("course") ?? defaultSlug;
  const course = useCourse(selected ?? undefined);
  const mastery = useCourseMastery(selected ?? undefined);

  if (progress.isError) {
    return (
      <EmptyState
        icon={AlertIcon}
        title={t("progress.error")}
        action={
          <Button variant="secondary" leadingIcon={RefreshIcon} onClick={() => void progress.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  const data = progress.data;

  return (
    <div className={styles.page}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{t("progress.eyebrow")}</p>
          <h1>{t("progress.title")}</h1>
          <p>{t("progress.subtitle")}</p>
        </div>
      </header>

      <section className={styles.top} aria-label={t("progress.overview")}>
        {!data ? (
          <>
            <Skeleton height={220} radius={20} />
            <Skeleton height={220} radius={20} />
            <Skeleton height={220} radius={20} />
          </>
        ) : (
          <>
            <Card className={styles.levelCard}>
              <ProgressRing
                value={data.level.progress}
                size={148}
                thickness={14}
                label={t("progress.levelRing", { level: data.level.level, percent: Math.round(data.level.progress * 100) })}
              >
                <span className={styles.levelSmall}>{t("progress.level")}</span>
                <span className={styles.levelBig}>{data.level.level}</span>
              </ProgressRing>
              <div className={styles.levelText}>
                <p className={styles.xpTotal}>
                  <StarIcon size={18} /> {t("home.xpTotal", { amount: formatNumber(data.totalXp) })}
                </p>
                <p className={styles.xpNext}>
                  {t("home.xpToNext", { amount: formatNumber(data.level.xpForNext - data.level.xpIntoLevel), level: data.level.level + 1 })}
                </p>
              </div>
            </Card>
            <Card className={styles.streakCard}>
              <StreakFlame streak={data.streak} />
            </Card>
            <Card className={styles.goalCard}>
              <ProgressRing
                value={data.minutesToday / Math.max(1, data.dailyGoalMinutes)}
                size={120}
                thickness={12}
                tone={data.minutesToday >= data.dailyGoalMinutes ? "success" : "accent"}
                label={t("home.goalRing", { minutes: data.minutesToday, goal: data.dailyGoalMinutes })}
              >
                <span className={styles.levelBig}>{data.minutesToday}</span>
                <span className={styles.levelSmall}>{t("progress.ofMinutes", { goal: data.dailyGoalMinutes })}</span>
              </ProgressRing>
              <p className={styles.goalText}>{data.minutesToday >= data.dailyGoalMinutes ? t("home.goalMet") : t("progress.goalToday")}</p>
            </Card>
          </>
        )}
      </section>

      <Card as="section" aria-labelledby="week-title" className={styles.section}>
        <h2 id="week-title" className={styles.sectionTitle}>
          {t("progress.weekTitle")}
        </h2>
        {data ? <WeeklyActivity days={data.recentActivity} goalMinutes={data.dailyGoalMinutes} /> : <Skeleton height={200} radius={16} />}
      </Card>

      <Card as="section" aria-labelledby="map-title" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 id="map-title" className={styles.sectionTitle}>
            {t("progress.mapTitle")}
          </h2>
          <div className={styles.coursePicker} role="group" aria-label={t("progress.pickCourse")}>
            {(courses.data?.courses ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.slug === selected}
                className={cx(styles.coursePill, c.slug === selected && styles.coursePillActive)}
                onClick={() => setParams({ course: c.slug }, { replace: true })}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>
        {course.data && mastery.data ? (
          <MasteryMap units={course.data.units} mastery={mastery.data.mastery} />
        ) : course.isError || mastery.isError ? (
          <EmptyState compact icon={AlertIcon} title={t("progress.mapError")} />
        ) : (
          <Skeleton height={260} radius={16} />
        )}
      </Card>
    </div>
  );
}
