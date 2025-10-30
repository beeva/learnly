# @learnly/shared

Domain types, validation schemas and constants shared by every Learnly surface —
the API, the web app and the mobile app all import from here so that a lesson,
an attempt or a sync operation means exactly the same thing everywhere.

```ts
import { attemptInputSchema, type Lesson } from "@learnly/shared";
```

Everything is plain TypeScript with no runtime dependencies other than `zod`,
so it bundles cleanly into React Native.

## Modules

- `ids.ts` — branded id helpers so a `LessonId` can never be passed where a `SkillId` is expected
- `domain.ts` — core entities: users, courses, units, skills, lessons, items, attempts
- `schemas.ts` — `zod` schemas for every request body the API accepts
- `progress.ts` — XP, levels and forgiving streak rules
- `i18n.ts` — encouragement copy keys and message formatting
- `sync.ts` — offline operation envelope used by the mobile outbox and `POST /v1/sync`

### Sync guarantees

Every operation carries a client-generated `opId`. The server records applied ids,
so replaying a batch after a dropped connection is always safe.
- `insights.ts` — educator insight shapes (struggle hotspots, class mastery heatmap)

### Locales

`en`, `es` and `fil` are supported. Use `resolveLocale()` to map a browser or device
locale (e.g. `es-MX`) to a supported one.
