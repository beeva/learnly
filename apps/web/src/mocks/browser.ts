import { setupWorker } from "msw/browser";
import { resetDb } from "./db";
import { handlers } from "./handlers";

declare global {
  interface Window {
    /** Demo helpers, handy when recording walkthroughs: `learnlyDemo.reset()`. */
    learnlyDemo?: { reset: () => void };
  }
}

/**
 * Starts the in-browser mock API (`VITE_USE_MOCKS=true` or `vite --mode mock`).
 * Requests that aren't part of the contract — fonts, assets — pass straight through.
 */
export async function startMockApi(): Promise<void> {
  const worker = setupWorker(...handlers);
  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: !import.meta.env.DEV,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
  window.learnlyDemo = {
    reset() {
      resetDb();
      localStorage.removeItem("learnly.session");
      window.location.assign("/");
    },
  };
}
