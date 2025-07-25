import type { StudentSnapshot } from "@learnly/shared";
import { useMemo, useState } from "react";
import { useT } from "../../i18n/I18nProvider";
import { Avatar, Badge, EmptyState, Switch, cx } from "../../ui/components";
import { ChevronDownIcon, ChevronUpIcon, FlagIcon, FlameIcon, UsersIcon } from "../../ui/icons";
import styles from "./Insights.module.css";

type SortKey = "name" | "minutes" | "streak" | "mastered" | "lastActive";
type Direction = "ascending" | "descending";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "2 days ago", "yesterday", "in 3 hours" — in the active locale. */
export function relativeTime(iso: string, locale: string, now = Date.now()): string {
  const diff = Date.parse(iso) - now;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms || unit === "minute") return format.format(Math.round(diff / ms), unit);
  }
  return format.format(0, "minute");
}

function compare(a: StudentSnapshot, b: StudentSnapshot, key: SortKey): number {
  switch (key) {
    case "name":
      return a.displayName.localeCompare(b.displayName);
    case "minutes":
      return a.minutesThisWeek - b.minutesThisWeek;
    case "streak":
      return a.streak - b.streak;
    case "mastered":
      return a.masteredSkills - b.masteredSkills;
    case "lastActive":
      return (a.lastActiveAt ? Date.parse(a.lastActiveAt) : 0) - (b.lastActiveAt ? Date.parse(b.lastActiveAt) : 0);
  }
}

export function StudentTable({ students }: { students: StudentSnapshot[] }) {
  const { t, locale, formatNumber } = useT();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [direction, setDirection] = useState<Direction>("ascending");
  const [attentionOnly, setAttentionOnly] = useState(false);

  const attentionCount = students.filter((student) => student.needsAttention).length;
  const rows = useMemo(() => {
    const filtered = attentionOnly ? students.filter((student) => student.needsAttention) : students;
    const sorted = filtered.slice().sort((a, b) => compare(a, b, sortKey));
    return direction === "ascending" ? sorted : sorted.reverse();
  }, [students, attentionOnly, sortKey, direction]);

  function sortBy(key: SortKey) {
    if (key === sortKey) setDirection((d) => (d === "ascending" ? "descending" : "ascending"));
    else {
      setSortKey(key);
      setDirection(key === "name" ? "ascending" : "descending");
    }
  }

  const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
    { key: "name", label: t("educator.students.name") },
    { key: "minutes", label: t("educator.students.minutes"), numeric: true },
    { key: "streak", label: t("educator.students.streak"), numeric: true },
    { key: "mastered", label: t("educator.students.mastered"), numeric: true },
    { key: "lastActive", label: t("educator.students.lastActive") },
  ];

  return (
    <section className={styles.panel} aria-labelledby="students-title">
      <div className={styles.heatmapHead}>
        <div className={styles.panelHead}>
          <h3 id="students-title" className={styles.panelTitle}>
            {t("educator.students.title")}
          </h3>
          <p className={styles.panelHint}>
            {attentionCount === 0 ? t("educator.students.allGood") : t("educator.students.attentionSummary", { count: attentionCount })}
          </p>
        </div>
        <div className={styles.filterSwitch}>
          <Switch checked={attentionOnly} onChange={setAttentionOnly} label={t("educator.students.filter")} disabled={attentionCount === 0} />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {t("educator.students.showing", { count: rows.length, total: students.length })}
      </p>

      {rows.length === 0 ? (
        <EmptyState compact icon={UsersIcon} title={t("educator.students.emptyTitle")} description={t("educator.students.emptyBody")} />
      ) : (
        <div className={styles.tableScroll} role="region" aria-labelledby="students-title" tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((column) => {
                  const active = column.key === sortKey;
                  return (
                    <th key={column.key} scope="col" aria-sort={active ? direction : "none"} className={cx(column.numeric && styles.numeric)}>
                      <button type="button" className={cx(styles.sortButton, active && styles.sortActive)} onClick={() => sortBy(column.key)}>
                        {column.label}
                        <span className={styles.sortIcon} aria-hidden="true">
                          {active && direction === "ascending" ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((student) => (
                <tr key={student.userId} className={cx(student.needsAttention && styles.attentionRow)}>
                  <th scope="row" className={styles.nameCell}>
                    <Avatar name={student.displayName} color={student.avatarColor} size={32} />
                    <span>{student.displayName}</span>
                    {student.needsAttention ? (
                      <Badge size="sm" tone="accent" icon={FlagIcon}>
                        {t("educator.students.needsAttention")}
                      </Badge>
                    ) : null}
                  </th>
                  <td className={styles.numeric}>{t("educator.students.minutesValue", { minutes: formatNumber(student.minutesThisWeek) })}</td>
                  <td className={styles.numeric}>
                    <span className={cx(styles.streak, student.streak === 0 && styles.streakCold)}>
                      <FlameIcon size={14} aria-hidden="true" />
                      {formatNumber(student.streak)}
                    </span>
                  </td>
                  <td className={styles.numeric}>{formatNumber(student.masteredSkills)}</td>
                  <td className={styles.muted}>{student.lastActiveAt ? relativeTime(student.lastActiveAt, locale) : t("educator.students.never")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
