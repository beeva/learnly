import { defineConfig } from "tsup";

/**
 * Production bundle. Workspace packages (@learnly/shared, @learnly/adaptive-engine) ship
 * TypeScript source, so they are bundled in; npm dependencies stay external and are
 * installed in the image (argon2 is a native module and can't be bundled anyway).
 */
export default defineConfig({
  entry: {
    server: "src/server.ts",
    migrate: "scripts/migrate.ts",
    seed: "src/db/seed/index.ts",
    "run-job": "scripts/run-job.ts",
  },
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  sourcemap: true,
  clean: true,
  splitting: true,
  noExternal: [/^@learnly\//],
});
