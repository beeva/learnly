# Contributing

## Workflow

1. Branch from `main` (`feat/…`, `fix/…`, `chore/…`).
2. Keep pull requests small and focused. Each one needs a green CI run and one review.
3. Use [Conventional Commits](https://www.conventionalcommits.org) with a scope:
   `feat(web): …`, `fix(api): …`, `test(engine): …`.

## Code style

- TypeScript strict everywhere. Don't use `any`; prefer the types from `@learnly/shared`.
- Prettier formats the code and ESLint catches mistakes. Run `pnpm lint && pnpm format`.
- Keep `@learnly/adaptive-engine` pure (no I/O and no dates from `Date.now()` inside
  algorithms) so it runs identically on the server and on devices.

## Tone of voice

Learnly speaks to children. Copy should be warm, specific and never shaming:

| Instead of | Write |
|---|---|
| "Wrong!" | "Not quite. Let's look at it together." |
| "You failed the quiz" | "Here's where we'll start." |
| "Score: 3/10" | "You've got 3 skills down. Let's build on them." |

## Database changes

Add a new numbered migration in `apps/api/migrations`. Never edit a migration that
has already been merged.
