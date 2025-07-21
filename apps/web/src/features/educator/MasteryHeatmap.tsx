import type { MasteryBand, MasteryHeatmap as MasteryHeatmapData, MasteryHeatmapCell } from "@learnly/shared";
import { useMemo, useState } from "react";
import { useT } from "../../i18n/I18nProvider";
import { EmptyState, cx } from "../../ui/components";
import { LayersIcon } from "../../ui/icons";
import { MASTERY_BANDS, bandColor } from "./MasteryDistribution";
import styles from "./Insights.module.css";

type SortMode = "average" | "name";

export function MasteryLegend() {
  const { t } = useT();
  return (
    <ul role="list" className={styles.legend} aria-label={t("educator.heatmap.legend")}>
      {MASTERY_BANDS.map((band) => (
        <li key={band}>
          <span className={cx(styles.legendSwatch, styles[`swatch-${band}`])} style={{ background: bandColor(band) }} aria-hidden="true" />
          {t(`mastery.${band}`)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Students × skills grid. A real table so screen readers can navigate by row and
 * column; each cell also spells out the band and percentage, never colour alone.
 */
export function MasteryHeatmap({ heatmap }: { heatmap: MasteryHeatmapData }) {
  const { t } = useT();
  const [sort, setSort] = useState<SortMode>("average");

  const cellIndex = useMemo(() => {
    const index = new Map<string, MasteryHeatmapCell>();
    for (const cell of heatmap.cells) index.set(`${cell.userId}:${cell.skillId}`, cell);
    return index;
  }, [heatmap.cells]);

  const rows = useMemo(() => {
    const withAverage = heatmap.students.map((student) => {
      const started = heatmap.skills
        .map((skill) => cellIndex.get(`${student.id}:${skill.id}`))
        .filter((cell): cell is MasteryHeatmapCell => cell !== undefined && cell.band !== "new");
      const average = started.length === 0 ? 0 : started.reduce((sum, cell) => sum + cell.pKnown, 0) / heatmap.skills.length;
      return { student, average };
    });
    return withAverage.sort((a, b) => (sort === "name" ? a.student.displayName.localeCompare(b.student.displayName) : b.average - a.average));
  }, [heatmap, cellIndex, sort]);

  if (heatmap.students.length === 0 || heatmap.skills.length === 0) {
    return <EmptyState compact icon={LayersIcon} title={t("educator.heatmap.emptyTitle")} description={t("educator.heatmap.emptyBody")} />;
  }

  const describe = (name: string, skill: string, band: MasteryBand, pKnown: number) =>
    band === "new"
      ? t("educator.heatmap.cellNew", { name, skill })
      : t("educator.heatmap.cell", { name, skill, band: t(`mastery.${band}`), percent: Math.round(pKnown * 100) });

  return (
    <section className={styles.panel} aria-labelledby="heatmap-title">
      <div className={styles.heatmapHead}>
        <div className={styles.panelHead}>
          <h3 id="heatmap-title" className={styles.panelTitle}>
            {t("educator.heatmap.title")}
          </h3>
          <p className={styles.panelHint}>{t("educator.heatmap.hint")}</p>
        </div>
        <div className={styles.heatmapControls}>
          <MasteryLegend />
          <label className={styles.sortLabel}>
            <span>{t("educator.heatmap.sort")}</span>
            <select className={styles.sortSelect} value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
              <option value="average">{t("educator.heatmap.sortAverage")}</option>
              <option value="name">{t("educator.heatmap.sortName")}</option>
            </select>
          </label>
        </div>
      </div>

      <div className={styles.heatmapScroll} role="region" aria-labelledby="heatmap-title" tabIndex={0}>
        <table className={styles.heatmap}>
          <caption className="sr-only">{t("educator.heatmap.caption", { students: heatmap.students.length, skills: heatmap.skills.length })}</caption>
          <thead>
            <tr>
              <th scope="col" className={styles.heatCorner}>
                {t("educator.heatmap.student")}
              </th>
              {heatmap.skills.map((skill) => (
                <th key={skill.id} scope="col" className={styles.skillHead} title={skill.name}>
                  <span className={styles.skillHeadText}>{skill.name}</span>
                </th>
              ))}
              <th scope="col" className={styles.avgHead}>
                {t("educator.heatmap.average")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, average }) => (
              <tr key={student.id}>
                <th scope="row" className={styles.studentCell}>
                  {student.displayName}
                </th>
                {heatmap.skills.map((skill) => {
                  const cell = cellIndex.get(`${student.id}:${skill.id}`);
                  const band: MasteryBand = cell?.band ?? "new";
                  const label = describe(student.displayName, skill.name, band, cell?.pKnown ?? 0);
                  return (
                    <td key={skill.id} className={styles.heatTd}>
                      <span className={cx(styles.heatCell, styles[`heat-${band}`])} style={{ background: bandColor(band) }} title={label}>
                        <span className="sr-only">{label}</span>
                        {band !== "new" ? (
                          <span className={styles.heatValue} aria-hidden="true">
                            {Math.round((cell?.pKnown ?? 0) * 100)}
                          </span>
                        ) : null}
                      </span>
                    </td>
                  );
                })}
                <td className={styles.avgCell}>{Math.round(average * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
