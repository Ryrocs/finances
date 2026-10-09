# Agent notes

- Read `docs/ARCHITECTURE.md` first. The app is a client-only PWA (Vite + React + TypeScript +
  Tailwind). **There is no backend, no login and no cloud**: all data lives in IndexedDB (Dexie)
  on the device. Do not add a server, an API or remote storage.
- Money is always integer cents (`src/lib/money.ts`); calendar dates are local `YYYY-MM-DD`
  strings (`src/lib/dates.ts`). Never use `new Date().toISOString()` for a movement date.
- Finance rules live only in `src/lib/finance/*` (pure functions, unit-tested). Transfers never
  count as income or expense.
- Every write goes through `src/db/repo.ts`. Schema changes: add a new `version(n)` in
  `src/db/db.ts` with an `.upgrade()`; never edit an existing version (users' data would be lost).
- The UI is in Catalan only and every string lives in `src/texts.ts`. Single currency: EUR.
- Checks: `npm run lint && npm run typecheck && npm test`, then `npm run build && npm run test:e2e`.
