import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n/I18nProvider";
import { Banner, Button } from "../ui/components";
import { CheckIcon, CloudOffIcon, RefreshIcon } from "../ui/icons";
import { useOnlineStatus, useOutbox } from "./sync";

type View = "offline" | "pending" | "synced" | null;

/**
 * Connection status, matching the mobile app: offline notice, a queue of
 * updates waiting to sync, and a brief confirmation once everything is caught up.
 */
export function OfflineBanner() {
  const { t } = useT();
  const online = useOnlineStatus();
  const { pending, status, flush } = useOutbox();
  const [justSynced, setJustSynced] = useState(false);
  const hadPending = useRef(pending > 0);

  useEffect(() => {
    if (hadPending.current && pending === 0 && online) {
      setJustSynced(true);
      const timer = setTimeout(() => setJustSynced(false), 3200);
      hadPending.current = false;
      return () => clearTimeout(timer);
    }
    if (pending > 0) hadPending.current = true;
    return undefined;
  }, [pending, online]);

  const view: View = !online ? "offline" : pending > 0 ? "pending" : justSynced ? "synced" : null;

  return (
    <div aria-live="polite" role="status">
      <AnimatePresence initial={false}>
        {view ? (
          <motion.div
            key={view}
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {view === "offline" ? (
              <Banner tone="warning" icon={CloudOffIcon} title={t("connection.offlineTitle")}>
                {t("connection.offlineBody")}
                {pending > 0 ? ` ${t("connection.pending", { count: pending })}.` : null}
              </Banner>
            ) : view === "pending" ? (
              <Banner
                tone="primary"
                icon={RefreshIcon}
                title={status === "syncing" ? t("connection.syncing") : t("connection.pending", { count: pending })}
                action={
                  status === "syncing" ? null : (
                    <Button size="sm" variant="secondary" onClick={() => void flush()}>
                      {t("connection.retry")}
                    </Button>
                  )
                }
              />
            ) : (
              <Banner tone="success" icon={CheckIcon} title={t("connection.synced")} />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
