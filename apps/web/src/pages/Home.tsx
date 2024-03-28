import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { Recommendation, RecommendationType } from "../api/client";
import { useCourses, useProgress, useRecommendations } from "../api/hooks";
import { useCurrentUser } from "../auth/AuthProvider";
import { StreakFlame } from "../features/progress/StreakFlame";
import { useT, type MessageKey } from "../i18n/I18nProvider";
import { Badge, Button, ButtonLink, Card, EmptyState, ProgressRing, Skeleton, cx } from "../ui/components";
import {
  AlertIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  ClockIcon,
  CompassIcon,
  LayersIcon,
  PlayIcon,
  RefreshIcon,
  SparklesIcon,
  TargetIcon,
  type IconComponent,
} from "../ui/icons";
import { CourseCover } from "./Courses";
import styles from "./Home.module.css";

export function recommendationHref(rec: Recommendation): string {
  switch (rec.type) {
    case "lesson":
      return rec.lessonId ? `/lessons/${rec.lessonId}?course=${encodeURIComponent(rec.courseSlug)}` : `/courses/${rec.courseSlug}`;
    case "practice":
      return `/practice/${rec.courseSlug}`;
    case "review":
      return `/practice/${rec.courseSlug}?kind=review`;
    case "diagnostic":
      return `/assess/${rec.courseSlug}`;
  }
}

const REC_ICON: Record<RecommendationType, IconComponent> = {
  lesson: PlayIcon,
  practice: TargetIcon,
  review: RefreshIcon,
  diagnostic: CompassIcon,
};

const REC_LABEL: Record<RecommendationType, MessageKey> = {
  lesson: "home.rec.lesson",
  practice: "home.rec.practice",
  review: "home.rec.review",
  diagnostic: "home.rec.diagnostic",
};

function greetingKey(hour: number): MessageKey {
  if (hour < 12) return "home.greeting.morning";
  if (hour < 18) return "home.greeting.afternoon";
  return "home.greeting.evening";
}

function ContinueCard({ rec }: { rec: Recommendation }) {
  const { t } = useT();
  const Icon = REC_ICON[rec.type];
  const isLesson = rec.type === "lesson";
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
      <Card padding="none" tone="primary" className={styles.continue}>
        <div className={styles.continueArt} aria-hidden="true">
          <span className={styles.orb} />
          <span className={styles.orbSmall} />
          <Icon size={44} />
        </div>
        <div className={styles.continueBody}>
          <p className={styles.continueEyebrow}>{isLesson ? t("home.continueTitle") : t(REC_LABEL[rec.type])}</p>
          <h2 className={styles.continueTitle}>{rec.title}</h2>
          <p className={styles.continueSubtitle}>{rec.subtitle}</p>
          <div className={styles.continueFooter}>
            <ButtonLink to={recommendationHref(rec)} variant="accent" size="lg" trailingIcon={ArrowRightIcon}>
              {isLesson ? t("home.resume") : t("home.start")}
            </ButtonLink>
            <span className={styles.continueMinutes}>
              <ClockIcon size={16} /> {t("common.minutes", { count: rec.estimatedMinutes })}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function RecommendationRow({ rec, index }: { rec: Recommendation; index: number }) {
  const { t } = useT();
  const Icon = REC_ICON[rec.type];
  return (
    <motion.li initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + index * 0.05 }}>
      <Link to={recommendationHref(rec)} className={styles.recRow}>
        <span className={cx(styles.recIcon, styles[`rec-${rec.type}`])}>
          <Icon size={20} />
        </span>
        <span className={styles.recText}>
          <span className={styles.recTitle}>{rec.title}</span>
          <span className={styles.recSubtitle}>{rec.subtitle}</span>
        </span>
        <Badge size="sm" className={styles.recBadge}>
          {t(REC_LABEL[rec.type])}
        </Badge>
        <span className={styles.recMinutes}>{t("common.minutes", { count: rec.estimatedMinutes })}</span>
        <ChevronRightIcon size={18} className={styles.recChevron} />
      </Link>
    </motion.li>
  );
}

export function HomePage() {
  const user = useCurrentUser();
  const { t, formatNumber } = useT();
  const progress = useProgress();
  const recommendations = useRecommendations();
  const courses = useCourses();

  const firstName = user.displayName.split(" ")[0] ?? user.displayName;
  const recs = recommendations.data?.next ?? [];
  const [primary, ...rest] = recs;
  const isNew = progress.data ? progress.data.mastery.every((m) => m.attempts === 0) && progress.data.totalXp === 0 : false;
  const myCourses = (courses.data?.courses ?? []).slice().sort((a, b) => Number(b.gradeBand === user.gradeBand) - Number(a.gradeBand === user.gradeBand));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</p>
          <h1 className={styles.greeting}>{t(greetingKey(new Date().getHours()), { name: firstName })}</h1>
          <p className={styles.subline}>
            {progress.data && progress.data.streak.current > 0 ? t("home.streakLine", { count: progress.data.streak.current }) : t("home.readyLine")}
          </p>
        </div>
      </header>

      {isNew ? (
        <Card tone="accent" className={styles.welcome}>
          <div className={styles.welcomeIcon} aria-hidden="true">
            <SparklesIcon size={28} />
          </div>
          <div className={styles.welcomeText}>
            <h2>{t("home.welcomeTitle")}</h2>
            <p>{t("home.welcomeBody")}</p>
          </div>
          <ButtonLink to="/welcome" trailingIcon={ArrowRightIcon}>
            {t("home.welcomeCta")}
          </ButtonLink>
        </Card>
      ) : null}

      <section className={styles.stats} aria-label={t("home.statsLabel")}>
        {progress.isPending ? (
          <>
            <Skeleton height={132} radius={20} />
            <Skeleton height={132} radius={20} />
            <Skeleton height={132} radius={20} />
          </>
        ) : progress.data ? (
          <>
            <Card className={styles.stat}>
              <ProgressRing
                value={progress.data.level.progress}
                size={84}
                thickness={9}
                label={t("progress.levelRing", { level: progress.data.level.level, percent: Math.round(progress.data.level.progress * 100) })}
              >
                <span className={styles.ringSmall}>{t("progress.level")}</span>
                <span className={styles.ringBig}>{progress.data.level.level}</span>
              </ProgressRing>
              <div className={styles.statText}>
                <span className={styles.statValue}>{t("home.xpTotal", { amount: formatNumber(progress.data.totalXp) })}</span>
                <span className={styles.statLabel}>
                  {t("home.xpToNext", { amount: formatNumber(progress.data.level.xpForNext - progress.data.level.xpIntoLevel), level: progress.data.level.level + 1 })}
                </span>
              </div>
            </Card>
            <Card className={styles.stat}>
              <StreakFlame streak={progress.data.streak} size="sm" />
            </Card>
            <Card className={styles.stat}>
              <ProgressRing
                value={progress.data.minutesToday / Math.max(1, progress.data.dailyGoalMinutes)}
                size={84}
                thickness={9}
                tone={progress.data.minutesToday >= progress.data.dailyGoalMinutes ? "success" : "accent"}
                label={t("home.goalRing", { minutes: progress.data.minutesToday, goal: progress.data.dailyGoalMinutes })}
              >
                <span className={styles.ringBig}>{progress.data.minutesToday}</span>
                <span className={styles.ringSmall}>/ {progress.data.dailyGoalMinutes}</span>
              </ProgressRing>
              <div className={styles.statText}>
                <span className={styles.statValue}>{progress.data.minutesToday >= progress.data.dailyGoalMinutes ? t("home.goalMet") : t("home.goalTitle")}</span>
                <span className={styles.statLabel}>{t("home.goalBody", { goal: progress.data.dailyGoalMinutes })}</span>
              </div>
            </Card>
          </>
        ) : null}
      </section>

      <section aria-labelledby="continue-title" className={styles.section}>
        <h2 id="continue-title" className="sr-only">
          {t("home.continueTitle")}
        </h2>
        {recommendations.isPending ? (
          <Skeleton height={240} radius={28} />
        ) : recommendations.isError ? (
          <EmptyState
            compact
            icon={AlertIcon}
            title={t("home.recsError")}
            action={
              <Button variant="secondary" leadingIcon={RefreshIcon} onClick={() => void recommendations.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : primary ? (
          <ContinueCard rec={primary} />
        ) : (
          <EmptyState compact icon={LayersIcon} title={t("home.recsEmpty")} action={<ButtonLink to="/courses">{t("nav.courses")}</ButtonLink>} />
        )}
      </section>

      {rest.length > 0 ? (
        <section aria-labelledby="next-title" className={styles.section}>
          <h2 id="next-title" className={styles.sectionTitle}>
            {t("home.upNext")}
          </h2>
          <ul role="list" className={styles.recList}>
            {rest.map((rec, index) => (
              <RecommendationRow key={`${rec.type}-${rec.title}`} rec={rec} index={index} />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="courses-title" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 id="courses-title" className={styles.sectionTitle}>
            {t("home.courses")}
          </h2>
          <Link to="/courses" className={styles.sectionLink}>
            {t("home.allCourses")} <ChevronRightIcon size={16} />
          </Link>
        </div>
        <ul role="list" className={styles.courseStrip}>
          {courses.isPending
            ? Array.from({ length: 3 }, (_, i) => (
                <li key={i}>
                  <Skeleton height={150} radius={20} />
                </li>
              ))
            : myCourses.slice(0, 4).map((course) => (
                <li key={course.id}>
                  <Link to={`/courses/${course.slug}`} className={styles.courseTile}>
                    <CourseCover course={course} size="sm" />
                    <span className={styles.courseTileBody}>
                      <span className={styles.courseTileTitle}>{course.title}</span>
                      <span className={styles.courseTileMeta}>{t("welcome.courseMeta", { units: course.unitCount })}</span>
                    </span>
                  </Link>
                </li>
              ))}
        </ul>
      </section>
    </div>
  );
}
