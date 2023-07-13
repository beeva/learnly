# 1. Use a pnpm monorepo

Date: 2023-05-04
Status: Accepted

## Context

Learnly will have an API, a web app and (later) a mobile app. All of them need the
same notion of a lesson, an item, an attempt and mastery. If those types drift
apart, bugs slip through quietly: an item kind the client can't render, or a
response shape the API rejects.

## Decision

One repository with pnpm workspaces and Turborepo. Shared code lives in `packages/*`,
and each deployable app lives in `apps/*`. Packages are consumed as TypeScript source,
so we don't need a separate build step while developing.

## Consequences

- One pull request can change the contract and every consumer at once.
- CI must be selective (`turbo run --filter=...[origin/main]`) to stay fast.
