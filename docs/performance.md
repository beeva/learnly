# Performance

**Budget:** a lesson is interactive in under **2 seconds** on a mid-range Android phone
on a 4G connection, and instantly when the lesson has been downloaded for offline use.

## Where the time went (before)

Profiling in early 2026 showed a cold lesson open at 3.4s p75 on the web:

| Phase | Before | After |
|---|---|---|
| JS for lesson route | 410 KB | 128 KB (route split, lazy Recharts) |
| `GET /v1/lessons/:id` | 380 ms | 90 ms (ETag + covering index on items) |
| Fonts | 2 render-blocking requests | preloaded subset with `font-display: swap` |
| Next lesson | fetched on open | prefetched while finishing the current lesson |
