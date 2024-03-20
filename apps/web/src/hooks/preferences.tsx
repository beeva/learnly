import { MotionConfig, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";

/**
 * Applies the learner's "reduce motion" preference on top of the OS setting:
 * framer-motion animations are skipped and CSS transitions collapse via
 * `html[data-motion="reduced"]`.
 */
export function MotionPreferences({ children }: { children: ReactNode }) {
  const { preferences } = useAuth();
  const reduced = preferences?.reducedMotion ?? false;

  useEffect(() => {
    const root = document.documentElement;
    if (reduced) root.dataset.motion = "reduced";
    else delete root.dataset.motion;
  }, [reduced]);

  return <MotionConfig reducedMotion={reduced ? "always" : "user"}>{children}</MotionConfig>;
}

/** True when either the OS or the learner's settings ask for less motion. */
export function useCalmMotion(): boolean {
  const { preferences } = useAuth();
  const system = useReducedMotion() ?? false;
  return system || (preferences?.reducedMotion ?? false);
}

type Chime = "correct" | "mastered" | "levelUp";

const CHIMES: Record<Chime, number[]> = {
  // Gentle major-key arpeggios; nothing that sounds like a buzzer.
  correct: [659.25, 987.77],
  mastered: [523.25, 659.25, 783.99, 1046.5],
  levelUp: [392, 523.25, 659.25, 783.99],
};

/** Soft synthesized chimes, played only when the learner turned sound effects on. */
export function useSoundEffects() {
  const { preferences } = useAuth();
  const enabled = preferences?.soundEffects ?? false;
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(
    () => () => {
      void contextRef.current?.close();
      contextRef.current = null;
    },
    [],
  );

  return useCallback(
    (chime: Chime) => {
      if (!enabled || typeof window === "undefined" || !("AudioContext" in window)) return;
      const ctx = contextRef.current ?? new AudioContext();
      contextRef.current = ctx;
      const start = ctx.currentTime + 0.01;
      CHIMES[chime].forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = frequency;
        const at = start + index * 0.09;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.12, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
        osc.connect(gain).connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.5);
      });
    },
    [enabled],
  );
}
