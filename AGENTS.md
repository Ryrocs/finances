<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes

- Read `docs/ARCHITECTURE.md` first. Production runs on Vercel (serverless) with Neon Postgres — never add a filesystem, SQLite or in-memory store for data.
- Money is always integer cents (`src/lib/money.ts`); calendar dates are `YYYY-MM-DD` strings (`src/lib/dates.ts`).
- Finance rules live only in `src/lib/finance/*` (unit-tested). Transfers never count as income/expense.
- Every server query must be scoped by the session user id (`authed()` in `src/server/http.ts`).
- UI text goes in `src/lib/i18n/messages/{en,ca,es}.ts` (ca is the default; `ca`/`es` are typed against `en`).
- Schema changes: edit `src/server/db/schema.ts`, run `npm run db:generate`, commit `drizzle/`.
- Checks: `npm run lint && npm run typecheck && npm test`, then `npm run build && npm run test:e2e`.
