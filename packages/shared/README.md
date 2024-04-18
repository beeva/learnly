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
