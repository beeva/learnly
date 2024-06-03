import { motion } from "framer-motion";
import type { ActivityDay } from "../../api/client";
import { getLocale, useT } from "../../i18n/I18nProvider";
import { cx } from "../../ui/components";
import styles from "./progress.module.css";

export interface WeeklyActivityProps {
  days: ActivityDay[];
  goalMinutes: number;
}

function weekday(day: string): string {
  // Noon avoids timezone edge cases turning "2024-05-06" into the previous day.
  return new Intl.DateTimeFormat(getLocale(), { weekday: "short" }).format(new Date(`${day}T12:00:00`));
}

/** Seven-day minutes chart with the daily goal drawn as a dashed line. */
export function WeeklyActivity({ days, goalMinutes }: WeeklyActivityProps) {
  const { t } = useT();
  const max = Math.max(goalMinutes * 1.25, ...days.map((d) => d.minutes), 1);
  const goalDays = days.filter((d) => d.minutes >= goalMinutes).length;
  const total = days.reduce((sum, d) => sum + d.minutes, 0);
  const lastIndex = days.length - 1;

  return (
    <div className={styles.week}>
      <div className={styles.weekSummary}>
        <p className={styles.weekTotal}>{t("progress.weekMinutes", { count: total })}</p>
        <p className={styles.weekGoalDays}>{t("progress.weekGoalDays", { count: goalDays, total: days.length })}</p>
      </div>
      <div className={styles.chart}>
        <div className={styles.goalLine} style={{ bottom: `${(goalMinutes / max) * 100}%` }} aria-hidden="true">
          <span>{t("progress.goalLine", { count: goalMinutes })}</span>
        </div>
        <ol role="list" className={styles.bars}>
          {days.map((day, index) => {
            const met = day.minutes >= goalMinutes;
            const label = weekday(day.day);
            return (
              <li key={day.day} className={styles.barCol}>
                <span className="sr-only">{t("progress.dayMinutes", { day: label, count: day.minutes })}</span>
                <div className={styles.barTrack} aria-hidden="true">
                  <motion.div
                    className={cx(styles.bar, met && styles.barMet, index === lastIndex && styles.barToday)}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(day.minutes > 0 ? 4 : 0, (day.minutes / max) * 100)}%` }}
                    transition={{ duration: 0.7, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {day.minutes > 0 ? <span className={styles.barValue}>{day.minutes}</span> : null}
                  </motion.div>
                </div>
                <span className={cx(styles.barLabel, index === lastIndex && styles.barLabelToday)} aria-hidden="true">
                  {index === lastIndex ? t("progress.today") : label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
