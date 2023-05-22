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

