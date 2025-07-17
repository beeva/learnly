import type { SkillHotspot } from "@learnly/shared";
import { motion } from "framer-motion";
import { useT } from "../../i18n/I18nProvider";
import { Badge, EmptyState } from "../../ui/components";
import { LightbulbIcon, SparklesIcon, UsersIcon } from "../../ui/icons";
import styles from "./Insights.module.css";

/** Skills with the most errors in the window, and the wrong idea behind them. */
export function HotspotList({ hotspots }: { hotspots: SkillHotspot[] }) {
  const { t } = useT();
  const sorted = hotspots.slice().sort((a, b) => b.errorRate - a.errorRate);

  return (
    <section className={styles.panel} aria-labelledby="hotspots-title">
      <div className={styles.panelHead}>
        <h3 id="hotspots-title" className={styles.panelTitle}>
          {t("educator.hotspots.title")}
        </h3>
        <p className={styles.panelHint}>{t("educator.hotspots.hint")}</p>
      </div>
      {sorted.length === 0 ? (
        <EmptyState compact icon={SparklesIcon} title={t("educator.hotspots.emptyTitle")} description={t("educator.hotspots.emptyBody")} />
      ) : (
        <ol role="list" className={styles.hotspots}>
          {sorted.map((hotspot, index) => {
            const percent = Math.round(hotspot.errorRate * 100);
            return (
              <motion.li
                key={hotspot.skillId}
                className={styles.hotspot}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className={styles.hotspotHead}>
                  <span className={styles.hotspotRank} aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className={styles.hotspotName}>
                    <strong>{hotspot.skillName}</strong>
                    <span>{hotspot.unitTitle}</span>
                  </div>
                  <Badge size="sm" tone={hotspot.studentsStruggling > 0 ? "accent" : "neutral"} icon={UsersIcon}>
                    {t("educator.hotspots.struggling", { count: hotspot.studentsStruggling })}
                  </Badge>
                </div>
                <div className={styles.errorRow}>
                  <div
                    className={styles.errorBar}
                    role="meter"
                    aria-label={t("educator.hotspots.errorRate", { skill: hotspot.skillName })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                  >
                    <motion.span
                      className={styles.errorFill}
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.7, delay: 0.1 + index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <span className={styles.errorValue}>{t("educator.hotspots.errorValue", { percent })}</span>
                </div>
                {hotspot.commonMisconception ? (
                  <p className={styles.misconception}>
                    <LightbulbIcon size={16} />
                    <span>
                      <strong>{t("educator.hotspots.misconception")}</strong> {hotspot.commonMisconception}
                    </span>
                  </p>
                ) : null}
              </motion.li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
