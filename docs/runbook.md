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
