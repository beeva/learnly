import type { MouseEvent } from "react";
import { t } from "../i18n/I18nProvider";

/**
 * First focusable element on every page. Jumps past the navigation to the
 * page's <main id="main">, moving focus as well as scroll position.
 */
export function SkipLink() {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const main = document.getElementById("main");
    if (!main) return;
    event.preventDefault();
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    main.focus();
    main.scrollIntoView({ block: "start" });
  }

  return (
    <a href="#main" className="skip-link" onClick={onClick}>
      {t("a11y.skipToContent")}
    </a>
  );
}
