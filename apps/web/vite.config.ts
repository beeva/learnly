/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

/**
 * The config object is assembled in steps (dev server, tests, build tuning) and
 * handed to Vite lazily, so each concern lives next to the reason it exists.
 */
const config: UserConfig = {
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/v1": { target: process.env.LEARNLY_API_ORIGIN ?? "http://localhost:4000", changeOrigin: true },
      "/healthz": { target: process.env.LEARNLY_API_ORIGIN ?? "http://localhost:4000", changeOrigin: true },
    },
  },
  preview: { port: 4173 },
};

export default defineConfig(() => config);

config.test = {
  environment: "jsdom",
  setupFiles: ["./src/test/setup.ts"],
  include: ["src/**/*.test.{ts,tsx}"],
  css: { modules: { classNameStrategy: "non-scoped" } },
  restoreMocks: true,
};

config.build = {
  target: "es2022",
  sourcemap: true,
  reportCompressedSize: false,
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (!id.includes("node_modules")) return undefined;
        if (/recharts|d3-|victory-vendor/.test(id)) return "charts";
        if (id.includes("framer-motion")) return "motion";
        if (/react-router|@remix-run/.test(id)) return "router";
        if (/react-dom|scheduler|[\\/]react[\\/]/.test(id)) return "react";
        if (id.includes("@tanstack")) return "query";
        return undefined;
      },
    },
  },
};
