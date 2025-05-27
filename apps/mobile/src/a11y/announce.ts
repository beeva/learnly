import { useEffect, useState, type RefObject } from "react";
import { AccessibilityInfo, findNodeHandle, Platform } from "react-native";

/**
 * VoiceOver drops announcements made while it is still reading a focus change,
 * so on iOS we wait a beat before speaking.
 */
export function announce(message: string, delayMs = Platform.OS === "ios" ? 400 : 0): void {
  if (!message) return;
  if (delayMs <= 0) {
    AccessibilityInfo.announceForAccessibility(message);
    return;
  }
  setTimeout(() => AccessibilityInfo.announceForAccessibility(message), delayMs);
}

/** Moves screen reader focus to `ref` once mounted — e.g. a screen title after navigation. */
export function useFocusOnMount(ref: RefObject<unknown>, delay = 300): void {
  useEffect(() => {
    const timer = setTimeout(() => {
      const node = ref.current ? findNodeHandle(ref.current as Parameters<typeof findNodeHandle>[0]) : null;
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, delay);
    return () => clearTimeout(timer);
  }, [ref, delay]);
}

export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (mounted) setEnabled(value);
    });
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setEnabled);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return enabled;
}
