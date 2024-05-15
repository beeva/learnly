import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useCalmMotion } from "../../hooks/preferences";
import { useT } from "../../i18n/I18nProvider";
import { Button } from "../../ui/components";
import { StarIcon, TrophyIcon } from "../../ui/icons";
import styles from "./Practice.module.css";

/** "+15 XP" that floats up from wherever it's rendered. Re-key it to replay. */
export function XpPop({ amount }: { amount: number }) {
  const { t } = useT();
  const calm = useCalmMotion();
  if (amount <= 0) return null;
  return (
    <motion.span
      className={styles.xpPop}
      initial={calm ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.8 }}
      animate={calm ? { opacity: 1 } : { opacity: [0, 1, 1, 0.9], y: [8, -6, -10, -14], scale: [0.8, 1.15, 1, 1] }}
      transition={{ duration: 1.1, ease: "easeOut" }}
    >
      <StarIcon size={14} />
      {t("practice.xp", { amount })}
    </motion.span>
  );
}

const CONFETTI_COLORS = ["#5B5BD6", "#FF7A59", "#2FB67C", "#F5A524", "#8585F0", "#FFB39F"];

/** A one-shot confetti burst. Renders nothing when motion should be calm. */
export function Confetti({ pieces = 42 }: { pieces?: number }) {
  const calm = useCalmMotion();
  const particles = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        const angle = (i / pieces) * Math.PI * 2 + Math.random() * 0.4;
        const distance = 140 + Math.random() * 180;
        return {
          id: i,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 80,
          rotate: Math.random() * 540 - 270,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          size: 6 + Math.random() * 8,
          round: i % 3 === 0,
          delay: Math.random() * 0.12,
        };
      }),
    [pieces],
  );
  if (calm) return null;
  return (
    <div className={styles.confetti} aria-hidden="true">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className={styles.confettiPiece}
          style={{ background: p.color, width: p.size, height: p.round ? p.size : p.size * 0.45, borderRadius: p.round ? "50%" : 2 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 220], opacity: [1, 1, 0], rotate: p.rotate, scale: 1 }}
          transition={{ duration: 1.8, delay: p.delay, ease: [0.16, 1, 0.3, 1], times: [0, 0.45, 1] }}
        />
      ))}
    </div>
  );
}

export interface MasteryCelebrationProps {
  open: boolean;
  skillName: string;
  onClose: () => void;
}

/** Full-screen moment for mastering a skill — earned, so it gets a little ceremony. */
export function MasteryCelebration({ open, skillName, onClose }: MasteryCelebrationProps) {
  const { t } = useT();
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => buttonRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div className={styles.celebrationBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Confetti />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={styles.celebration}
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
          >
            <motion.div
              className={styles.trophy}
              initial={{ rotate: -12, scale: 0.6 }}
              animate={{ rotate: [-12, 8, -4, 0], scale: [0.6, 1.15, 1] }}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              <TrophyIcon size={48} />
            </motion.div>
            <p className="eyebrow">{t("practice.celebration.eyebrow")}</p>
            <h2 id={titleId} className={styles.celebrationTitle}>
              {t("encouragement.mastered", { skill: skillName })}
            </h2>
            <p className={styles.celebrationBody}>{t("practice.celebration.body")}</p>
            <Button ref={buttonRef} size="lg" onClick={onClose}>
              {t("practice.celebration.continue")}
            </Button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
