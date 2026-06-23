# Runbook

## Deploys

- Merging to `main` deploys to **staging** automatically (`.github/workflows/deploy.yml`).
- Tag `vX.Y.Z` on `main` to promote to **production**. The workflow waits for approval in
  the `production` environment.
- Migrations run as a one-off ECS task before the new API task definition is rolled out.
  Migrations must be backwards compatible with the previous release.

## Rollback

1. Re-run the deploy workflow for the previous tag.
2. If a migration is at fault, ship a new forward migration. Never run down-migrations
   in production.

## Alerts

| Alert | First steps |
|---|---|
| `api_5xx_rate > 2%` for 5m | Check the latest deploy, then `/readyz` and RDS connections |
| `sync_rejected_ops` spike | Look at `reason` in logs. Usually a client sending an expired schema version |
| `attempt_latency_p95 > 400ms` | Check for lock contention on `skill_mastery` (`pg_stat_activity`) |
| Nightly BKT job failed | Safe to retry. The engine falls back to the last fitted parameters |
