import { Component, type ErrorInfo, type ReactNode } from "react";
import { track } from "../analytics/tracker";
import { t } from "../i18n/I18nProvider";
import { Button, ButtonLink } from "../ui/components";
import { AlertIcon, HomeIcon, LogoMark, RefreshIcon, SparklesIcon } from "../ui/icons";
import styles from "./ErrorBoundary.module.css";

/** After a deploy, old tabs ask for chunks that no longer exist. That's an update, not a bug. */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /dynamically imported module|Importing a module script failed|Loading chunk [\d]+ failed|error loading dynamically/i.test(message);
}

export interface ErrorScreenProps {
  error?: unknown;
  title?: string;
  body?: string;
  /** Render inside the router (enables the home link) or above it. */
  withHomeLink?: boolean;
  onRetry?: () => void;
}

export function ErrorScreen({ error, title, body, withHomeLink = false, onRetry }: ErrorScreenProps) {
  const stale = isStaleChunkError(error);
  const Icon = stale ? SparklesIcon : AlertIcon;
  return (
    <div className={styles.screen} role="alert">
      <div className={styles.card}>
        <LogoMark size={36} className={styles.logo} />
        <span className={styles.icon} aria-hidden="true">
          <Icon size={28} />
        </span>
        <h1 className={styles.title}>{title ?? (stale ? t("errors.updatedTitle") : t("errors.boundaryTitle"))}</h1>
        <p className={styles.body}>{body ?? (stale ? t("errors.updatedBody") : t("errors.boundaryBody"))}</p>
        <div className={styles.actions}>
          <Button leadingIcon={RefreshIcon} onClick={onRetry ?? (() => window.location.reload())}>
            {t("errors.reload")}
          </Button>
          {withHomeLink ? (
            <ButtonLink to="/home" variant="secondary" leadingIcon={HomeIcon}>
              {t("errors.home")}
            </ButtonLink>
          ) : (
            <Button variant="secondary" leadingIcon={HomeIcon} onClick={() => window.location.assign("/home")}>
              {t("errors.home")}
            </Button>
          )}
        </div>
        {import.meta.env.DEV && error instanceof Error ? (
          <details className={styles.details}>
            <summary>{t("errors.details")}</summary>
            <pre>{error.stack ?? error.message}</pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}

interface BoundaryState {
  error: unknown;
}

/** Last line of defence above the router: a friendly screen instead of a blank page. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    track("client_error", { where: "app", stale: isStaleChunkError(error), component: (info.componentStack ?? "").split("\n")[1]?.trim().slice(0, 80) ?? "" });
    if (import.meta.env.DEV) console.error(error, info.componentStack);
  }

  override render() {
    if (this.state.error) return <ErrorScreen error={this.state.error} />;
    return this.props.children;
  }
}
