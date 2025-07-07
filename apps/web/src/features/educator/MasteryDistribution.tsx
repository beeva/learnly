import type { MasteryBand } from "@learnly/shared";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { useCalmMotion } from "../../hooks/preferences";
import { useT } from "../../i18n/I18nProvider";
import styles from "./Insights.module.css";

export const MASTERY_BANDS: readonly MasteryBand[] = ["new", "learning", "practicing", "mastered"];

/** Mastery bands are an ordered scale, so they read light → strong via the shared tokens. */
export function bandColor(band: MasteryBand): string {
  return `var(--mastery-${band})`;
}

interface Datum {
  band: MasteryBand;
  label: string;
  count: number;
  share: number;
}

function DistributionTooltip({ active, payload }: TooltipProps<number, string>) {
  const { t } = useT();
  const datum = payload?.[0]?.payload as Datum | undefined;
  if (!active || !datum) return null;
  return (
    <div className={styles.chartTooltip}>
      <span className={styles.tooltipSwatch} style={{ background: bandColor(datum.band) }} aria-hidden="true" />
      <div>
        <strong>{datum.label}</strong>
        <span>{t("educator.distribution.tooltip", { count: datum.count, percent: Math.round(datum.share * 100) })}</span>
      </div>
    </div>
  );
}

export function MasteryDistribution({ distribution }: { distribution: Record<MasteryBand, number> }) {
  const { t } = useT();
  const calm = useCalmMotion();
  const total = MASTERY_BANDS.reduce((sum, band) => sum + distribution[band], 0);
  const data: Datum[] = MASTERY_BANDS.map((band) => ({
    band,
    label: t(`mastery.${band}`),
    count: distribution[band],
    share: total === 0 ? 0 : distribution[band] / total,
  }));
  const strongest = data.reduce<Datum>((best, datum) => (datum.count > best.count ? datum : best), data[0] ?? { band: "new", label: "", count: 0, share: 0 });

  return (
    <figure className={styles.chartFigure}>
      <figcaption className={styles.chartCaption}>
        <h3 className={styles.panelTitle}>{t("educator.distribution.title")}</h3>
        <p className={styles.panelHint}>
          {total === 0 ? t("educator.distribution.empty") : t("educator.distribution.summary", { band: strongest.label, percent: Math.round(strongest.share * 100) })}
        </p>
      </figcaption>
      <div className={styles.chart} aria-hidden="true">
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: -16 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="0" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--color-border-strong)" }} tick={{ fill: "var(--color-text-muted)", fontSize: 13 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-subtle)", fontSize: 12 }} width={44} />
            <Tooltip content={<DistributionTooltip />} cursor={{ fill: "var(--color-surface-hover)" }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={!calm} maxBarSize={72}>
              {data.map((datum) => (
                <Cell key={datum.band} fill={bandColor(datum.band)} stroke="var(--color-surface)" strokeWidth={2} />
              ))}
              <LabelList dataKey="count" position="top" fill="var(--color-text)" fontSize={13} fontWeight={700} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t("educator.distribution.title")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("educator.distribution.band")}</th>
            <th scope="col">{t("educator.distribution.cells")}</th>
            <th scope="col">{t("educator.distribution.share")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.band}>
              <th scope="row">{datum.label}</th>
              <td>{datum.count}</td>
              <td>{Math.round(datum.share * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
