import { useEffect, useState } from "react";

type Politeness = "polite" | "assertive";

interface Message {
  text: string;
  politeness: Politeness;
  id: number;
}

let nextId = 1;
const listeners = new Set<(message: Message) => void>();

/**
 * Announce a message to screen readers from anywhere (route changes, saved
 * settings, background sync). Repeated identical messages are still announced.
 */
export function announce(text: string, politeness: Politeness = "polite"): void {
  const message = { text, politeness, id: nextId++ };
  listeners.forEach((listener) => listener(message));
}

/** Two visually hidden live regions; mount once near the root. */
export function Announcer() {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const listener = (message: Message) => {
      const set = message.politeness === "assertive" ? setAssertive : setPolite;
      // Clear first so assistive tech notices a change even for identical text.
      set("");
      timers.push(setTimeout(() => set(message.text), 60));
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="announcer-polite">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </>
  );
}
