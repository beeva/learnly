import { useEffect } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { isApiError } from "../api/client";
import { track } from "../analytics/tracker";
import { t } from "../i18n/I18nProvider";
import { ErrorScreen, isStaleChunkError } from "./ErrorBoundary";

/** Router-level error element: 404s, forbidden areas and unexpected render errors. */
export function RouteError() {
  const error = useRouteError();
  const notFound = (isRouteErrorResponse(error) && error.status === 404) || isApiError(error, "not_found");
  const forbidden = (isRouteErrorResponse(error) && error.status === 403) || isApiError(error, "forbidden");

  useEffect(() => {
    track("client_error", { where: "route", status: isRouteErrorResponse(error) ? error.status : 0, stale: isStaleChunkError(error) });
  }, [error]);

  if (notFound) return <ErrorScreen withHomeLink title={t("errors.notFoundTitle")} body={t("errors.notFoundBody")} />;
  if (forbidden) return <ErrorScreen withHomeLink title={t("errors.forbiddenTitle")} body={t("errors.forbiddenBody")} />;
  return <ErrorScreen withHomeLink error={error} />;
}
