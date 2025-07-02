import type { ClassroomInsights } from "@learnly/shared";
import type { ReactNode } from "react";
import { useT } from "../../i18n/I18nProvider";
import { Card, ProgressRing, cx } from "../../ui/components";
import { ClockIcon, FlagIcon, TrophyIcon, type IconComponent } from "../../ui/icons";
import styles from "./Insights.module.css";

function Tile({ label, value, detail, icon: Icon, visual, tone }: { label: string; value: ReactNode; detail: string; icon?: IconComponent; visual?: ReactNode; tone?: "accent" | "success" | "primary" }) {
  return (
    <Card as="li" padding="md" className={cx(styles.tile, tone && styles[`tile-${tone}`])}>
      {visual ?? (Icon ? (
        <span className={styles.tileIcon} aria-hidden="true">
          <Icon size={22} />
        </span>
      ) : null)}
      <div className={styles.tileText}>
        <span className={styles.tileLabel}>{label}</span>
        <span className={styles.tileValue}>{value}</span>
        <span className={styles.tileDetail}>{detail}</span>
      </div>
    </Card>
  );
}

export function OverviewTiles({ insights }: { insights: ClassroomInsights }) {
  const { t, formatNumber } = useT();
  const cells = Object.values(insights.masteryDistribution).reduce((sum, n) => sum + n, 0);
  const masteredShare = cells === 0 ? 0 : insights.masteryDistribution.mastered / cells;
  const attention = insights.students.filter((student) => student.needsAttention).length;
  const completion = Math.round(insights.completionRate * 100);

  return (
    <ul role="list" className={styles.tiles} aria-label={t("educator.overview.label")}>
      <Tile
        label={t("educator.overview.completion")}
        value={`${completion}%`}
        detail={t("educator.overview.completionDetail")}
        visual={<ProgressRing value={insights.completionRate} size={64} thickness={8} tone="primary" label={t("educator.overview.completion")} />}
      />
      <Tile
        label={t("educator.overview.minutes")}
        value={t("educator.overview.minutesValue", { minutes: formatNumber(insights.averageMinutesPerStudent) })}
        detail={t("educator.overview.minutesDetail")}
        icon={ClockIcon}
      />
      <Tile
        label={t("educator.overview.attention")}
        value={formatNumber(attention)}
        detail={attention === 0 ? t("educator.overview.attentionNone") : t("educator.overview.attentionDetail", { total: insights.students.length })}
        icon={FlagIcon}
        tone={attention > 0 ? "accent" : "success"}
      />
      <Tile
        label={t("educator.overview.mastered")}
        value={`${Math.round(masteredShare * 100)}%`}
        detail={t("educator.overview.masteredDetail")}
        icon={TrophyIcon}
        tone="success"
      />
    </ul>
  );
}
