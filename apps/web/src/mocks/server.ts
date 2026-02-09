import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** The mock API for vitest: the same handlers the browser demo uses, in Node. */
export const server = setupServer(...handlers);
