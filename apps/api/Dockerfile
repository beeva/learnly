# syntax=docker/dockerfile:1.7
# Build from the repository root:  docker build -f apps/api/Dockerfile -t learnly-api .

FROM node:20.15-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# Dependencies only change when manifests do, so this layer is cached across code changes.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/adaptive-engine/package.json packages/adaptive-engine/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@learnly/api..."

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/adaptive-engine packages/adaptive-engine
COPY apps/api apps/api
RUN pnpm --filter @learnly/api typecheck \
 && pnpm --filter @learnly/api build \
 && pnpm --filter @learnly/api deploy --prod /out

FROM node:20.15-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    MIGRATIONS_DIR=/app/migrations
WORKDIR /app

RUN groupadd --system learnly && useradd --system --gid learnly --home /app learnly

COPY --from=build --chown=learnly:learnly /out/node_modules ./node_modules
COPY --from=build --chown=learnly:learnly /repo/apps/api/dist ./dist
COPY --from=build --chown=learnly:learnly /repo/apps/api/migrations ./migrations
COPY --from=build --chown=learnly:learnly /repo/apps/api/package.json ./package.json

USER learnly
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Migrations run as a separate one-off task before rollout: `node dist/migrate.js`.
CMD ["node", "--enable-source-maps", "dist/server.js"]
