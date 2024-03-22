import type { StreakState } from "@learnly/shared";
import { motion } from "framer-motion";
import { useId } from "react";
import { useCalmMotion } from "../../hooks/preferences";
import { useT } from "../../i18n/I18nProvider";
import { cx } from "../../ui/components";
import { SnowflakeIcon } from "../../ui/icons";
import styles from "./progress.module.css";

function Flame({ lit, size }: { lit: boolean; size: number }) {
  const id = useId();
  const calm = useCalmMotion();
  const flicker = lit && !calm;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={cx(styles.flame, !lit && styles.flameOut)}>
      <defs>
        <linearGradient id={`${id}-outer`} x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={lit ? "#FFB347" : "#C2C1CF"} />
          <stop offset="0.55" stopColor={lit ? "#FF7A59" : "#9796AA"} />
          <stop offset="1" stopColor={lit ? "#EC5F3C" : "#6F6E85"} />
        </linearGradient>
        <linearGradient id={`${id}-inner`} x1="32" y1="26" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={lit ? "#FFF3C4" : "#EFEEF2"} />
          <stop offset="1" stopColor={lit ? "#F5A524" : "#C2C1CF"} />
        </linearGradient>
      </defs>
      <motion.path
        d="M32 60c-12.2 0-21-8.3-21-19.6 0-9.6 6.2-16 11.2-21.6 1.2 5.2 4 9 7.5 10.6-1-9.9 3.7-18.6 11.6-24.9.7 9 5.3 14.4 9.6 19.3 4.1 4.7 8.1 9.6 8.1 17.2C59 51.8 47.4 60 32 60z"
        fill={`url(#${id}-outer)`}
        style={{ originX: "50%", originY: "100%" }}
        animate={flicker ? { scaleY: [1, 1.04, 0.98, 1.03, 1], scaleX: [1, 0.98, 1.02, 0.99, 1] } : undefined}
        transition={flicker ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : undefined}
      />
      <motion.path
        d="M32 58c-6.6 0-11.4-4.4-11.4-10.3 0-5.6 4-9.1 6.9-12.6.6 3 2.3 5 4.3 5.9-.4-5.5 2.2-10 6.4-13.2.6 5 3 7.9 5.1 10.6 2 2.6 4 5.3 4 9.4C47.3 53.6 40.4 58 32 58z"
        fill={`url(#${id}-inner)`}
        style={{ originX: "50%", originY: "100%" }}
        animate={flicker ? { scaleY: [1, 0.95, 1.06, 0.98, 1] } : undefined}
        transition={flicker ? { duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 } : undefined}
      />
    </svg>
  );
}

export interface StreakFlameProps {
  streak: StreakState;
  size?: "sm" | "lg";
}

/** Streak with its flame and any banked freezes (which forgive one missed day each). */
export function StreakFlame({ streak, size = "lg" }: StreakFlameProps) {
  const { t } = useT();
  const lit = streak.current > 0;
  return (
    <div className={cx(styles.streak, size === "sm" && styles.streakSm)}>
      <div className={styles.flameWrap}>
        <Flame lit={lit} size={size === "sm" ? 64 : 104} />
        {lit ? <span className={styles.flameCount}>{streak.current}</span> : null}
      </div>
      <div className={styles.streakText}>
        <span className={styles.streakValue}>{lit ? t("progress.streakDays", { count: streak.current }) : t("progress.streakNone")}</span>
        <span className={styles.streakLabel}>{lit ? t("progress.streakLongest", { count: streak.longest }) : t("progress.streakStart")}</span>
        {streak.freezesAvailable > 0 ? (
          <span className={styles.freezes} title={t("progress.freezeHelp")}>
            {Array.from({ length: Math.min(3, streak.freezesAvailable) }, (_, i) => (
              <SnowflakeIcon key={i} size={14} />
            ))}
            {t("progress.freezes", { count: streak.freezesAvailable })}
            <span className="sr-only">. {t("progress.freezeHelp")}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
