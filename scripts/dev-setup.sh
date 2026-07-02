#!/usr/bin/env bash
# One-shot local setup: dependencies, database, migrations and seed data.
set -euo pipefail

command -v pnpm >/dev/null || { echo "pnpm is required: https://pnpm.io/installation"; exit 1; }
command -v docker >/dev/null || { echo "Docker is required for the local database"; exit 1; }

pnpm install
[ -f apps/api/.env ] || cp apps/api/.env.example apps/api/.env

pnpm db:up
echo "Waiting for Postgres..."
until docker compose exec -T postgres pg_isready -U learnly >/dev/null 2>&1; do sleep 1; done

pnpm db:migrate
pnpm db:seed

echo
echo "Ready! Run 'pnpm dev' and open http://localhost:5173"
echo "Demo student: maya@demo.learnly.app / learnly-demo-2024"
