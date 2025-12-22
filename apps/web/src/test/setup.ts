import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { tokenStore } from "../api/client";

// Animations finish instantly so AnimatePresence transitions don't slow tests down.
MotionGlobalConfig.skipAnimations = true;

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

if (!("ResizeObserver" in window)) {
  Object.defineProperty(window, "ResizeObserver", { writable: true, value: NoopObserver });
}

if (!("IntersectionObserver" in window)) {
  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    value: class extends NoopObserver {
      root = null;
      rootMargin = "";
      thresholds = [];
    },
  });
}

Element.prototype.scrollIntoView ??= function scrollIntoView() {};
window.scrollTo = (() => undefined) as typeof window.scrollTo;

if (!("requestIdleCallback" in window)) {
  Object.defineProperty(window, "requestIdleCallback", {
    writable: true,
    value: (callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 1),
  });
  Object.defineProperty(window, "cancelIdleCallback", { writable: true, value: (id: number) => window.clearTimeout(id) });
}

HTMLElement.prototype.hasPointerCapture ??= () => false;
HTMLElement.prototype.releasePointerCapture ??= () => undefined;
HTMLElement.prototype.setPointerCapture ??= () => undefined;

if (typeof CSS === "undefined" || !("escape" in CSS)) {
  vi.stubGlobal("CSS", { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`) });
}

// jsdom installs its own AbortSignal, which Node's Request (used by the data router
// and MSW) refuses. Tests never abort navigations, so drop the signal.
const NodeRequest = globalThis.Request;
globalThis.Request = class TestRequest extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (init?.signal) {
      const { signal: _signal, ...rest } = init;
      super(input, rest);
    } else {
      super(input, init);
    }
  }
} as typeof Request;

// jsdom's Blob predates arrayBuffer()/text().
Blob.prototype.arrayBuffer ??= function arrayBuffer(this: Blob) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(this);
  });
};
Blob.prototype.text ??= function text(this: Blob) {
  return this.arrayBuffer().then((buffer) => new TextDecoder().decode(buffer));
};

afterEach(() => {
  cleanup();
  tokenStore.clear();
  localStorage.clear();
});

const { server } = await import("../mocks/server");
const mockDb = await import("../mocks/db");

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  server.resetHandlers();
  mockDb.resetDb();
  mockDb.resetEducatorDb();
});

afterAll(() => server.close());
