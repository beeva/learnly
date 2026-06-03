# Accessibility

Learnly targets **WCAG 2.2 AA** on web, iOS and Android. Many of our students are
early readers, use assistive technology, or are learning in a second language,
so accessibility is part of the core product.

## What we do

- Every interactive element is reachable and operable by keyboard. Ordering items can be
  reordered with the arrow keys as well as by drag.
- Answer feedback is announced through an `aria-live="polite"` region (web) or
  `AccessibilityInfo.announceForAccessibility` (mobile).
- Focus moves to the main heading on route change, and a skip link is the first tab stop.
- Colour is never the only signal: mastery bands also use icons and labels.
- Animations respect `prefers-reduced-motion` and the in-app *Reduce motion* setting.
- Text scales up to 200% (web) and with Dynamic Type / font scale (mobile) without clipping.
