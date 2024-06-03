import type { MasteryBand, SkillMastery, Unit } from "@learnly/shared";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { useT } from "../../i18n/I18nProvider";
import { cx } from "../../ui/components";
import { CheckIcon } from "../../ui/icons";
import styles from "./progress.module.css";

export const BANDS: MasteryBand[] = ["new", "learning", "practicing", "mastered"];

export function MasteryLegend() {
  const { t } = useT();
  return (
    <ul role="list" className={styles.legend}>
      {BANDS.map((band) => (
        <li key={band}>
          <span className={cx(styles.legendSwatch, styles[`band-${band}`])} aria-hidden="true" />
          {t(`mastery.${band}`)}
        </li>
      ))}
    </ul>
  );
}

export interface MasteryMapProps {
  units: Unit[];
  mastery: SkillMastery[];
}

/** Every skill in a course as a tile coloured by mastery band, grouped by unit. */
export function MasteryMap({ units, mastery }: MasteryMapProps) {
  const { t } = useT();
  const bySkill = useMemo(() => new Map(mastery.map((m) => [m.skillId as string, m])), [mastery]);
  const counts = useMemo(() => {
    const result: Record<MasteryBand, number> = { new: 0, learning: 0, practicing: 0, mastered: 0 };
    for (const unit of units) for (const skill of unit.skills) result[bySkill.get(skill.id)?.band ?? "new"] += 1;
    return result;
  }, [units, bySkill]);
  const total = units.reduce((sum, unit) => sum + unit.skills.length, 0);

  return (
    <div className={styles.map}>
      <div className={styles.mapSummary}>
        <div className={styles.stackBar} role="img" aria-label={t("progress.mapSummary", { mastered: counts.mastered, total })}>
          {BANDS.slice()
            .reverse()
            .map((band) =>
              counts[band] > 0 ? <span key={band} className={cx(styles.stackSegment, styles[`band-${band}`])} style={{ flexGrow: counts[band] }} /> : null,
            )}
        </div>
        <MasteryLegend />
      </div>

      <ol role="list" className={styles.mapUnits}>
        {units.map((unit) => (
          <li key={unit.id} className={styles.mapUnit}>
            <h3 className={styles.mapUnitTitle}>
              <span className={styles.mapUnitNumber}>{unit.position}</span>
              {unit.title}
            </h3>
            <ul role="list" className={styles.tiles}>
              {unit.skills.map((skill, index) => {
                const m = bySkill.get(skill.id);
                const band = m?.band ?? "new";
                return (
                  <motion.li
                    key={skill.id}
                    className={cx(styles.tile, styles[`band-${band}`])}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <span className={styles.tileTop}>
                      <span className={styles.tileCode}>{skill.code}</span>
                      {band === "mastered" ? <CheckIcon size={16} /> : null}
                    </span>
                    <span className={styles.tileName}>{skill.name}</span>
                    <span className={styles.tileBand}>{t(`mastery.${band}`)}</span>
                    {m && m.attempts > 0 ? (
                      <span className={styles.tileMeter} aria-hidden="true">
                        <span style={{ width: `${Math.round(m.pKnown * 100)}%` }} />
                      </span>
                    ) : null}
                  </motion.li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
