# Finances

A mobile-first personal finance web app, built for **Vercel** with a **Neon Postgres** database.
It answers: how much did I earn and spend this month, where did it go, am I spending faster than
usual, how much budget is left, and how much liquid money do I have across my accounts.

* Cash flow (income/expenses) and liquid wealth (account balances) are separate concepts;
  transfers between accounts never count as income or expense.
* Catalan (default), Spanish and English.
* Installable as an app on the phone's home screen (PWA).

Technical decisions are explained in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Features

| Area | What it does |
| --- | --- |
| Dashboard | Month selector, monthly balance (income − expenses, highlighted when negative), income, expenses, liquid net worth, spending-rate projection, budget status, expense breakdown by category and group (Needs / Lifestyle / Other), recent movements |
| Movements | Create, edit, delete, search (description, notes, amount, category, account), filter by type / category / account / month, grouped by day, infinite scroll |
| Add movement | Bottom sheet: type → amount → category → account → save. "Today/Yesterday" shortcuts, remembers the last account, "Save + new" for fast entry |
| Accounts | Checking, savings, cash, other. Initial balance + date, liquid flag, colour, archive or delete |
| Net worth | Total liquid wealth, history (30D / 3M / 6M / 12M / All) reconstructed from real movements, distribution by account, non-liquid accounts listed separately |
| Budget | Overall monthly budget and per-category budgets, spent / remaining / %, daily allowance, warnings at 80 % and when exceeded (never blocks a movement) |
| Analytics | Income vs expenses, monthly balance, monthly expenses, expenses by category, month-vs-month comparison per category |
| Recurring | Weekly / monthly / yearly expenses, income and transfers, generated automatically once per occurrence |
| Settings | Profile, language, currency, accounts, categories, recurring movements, demo data (load/remove), CSV/JSON export, password change, log out, delete account |

## Deploy to Vercel (step by step)

1. **Import the repository** — vercel.com → *Add New… → Project* → import this GitHub repo.
   Framework preset: *Next.js* (detected). Leave the build/output settings as they are:
   `vercel.json` already sets the build command to `npm run vercel-build`.
2. **Create the database** — in the Vercel project: *Storage → Create Database → Neon (Serverless
   Postgres)*. Pick the region **Frankfurt (eu-central-1)** (the functions run in `fra1`, see
   `vercel.json`), keep the default environment-variable prefix, and connect it to
   **Production, Preview and Development**. This adds `DATABASE_URL` (pooled),
   `DATABASE_URL_UNPOOLED` and the `PG*` variables automatically.
3. **Add `CRON_SECRET`** — *Settings → Environment Variables* → `CRON_SECRET` = a random string
   (e.g. `openssl rand -hex 32`), for Production. Vercel Cron sends it to `/api/cron/recurring`.
4. **Deploy** (or *Redeploy* if the first build ran before the database existed). The build runs
   the database migrations first, then `next build`.
5. **Check** `https://<your-app>.vercel.app/api/health` → `{"ok":true,"database":"up","migrated":true}`.
6. **On your phone**: open the URL, create an account, then *Share → Add to Home Screen* (iOS) or
   *⋮ → Install app* (Android).

Every later `git push` redeploys; data lives in Neon and is not affected by deployments.
If Neon's *preview branching* is enabled, each preview deployment gets its own database branch
and its migrations run there.

### Environment variables

| Variable | Required | Set by | Used for |
| --- | --- | --- | --- |
| `DATABASE_URL` | **yes** | Neon integration | Runtime queries (pooled connection string). `POSTGRES_URL` is accepted as a fallback. |
| `DATABASE_URL_UNPOOLED` | recommended | Neon integration | Migrations (they take a session-level advisory lock). Falls back to `DATABASE_URL`. |
| `CRON_SECRET` | recommended | you | Protects the daily cron endpoint. Without it the cron is disabled; recurring movements are still generated when the user opens the app. |
| `SKIP_MIGRATIONS` | no | you | Set to `1` to skip migrations during a build. |

There is **no** auth secret to manage: sessions are random tokens stored (hashed) in Postgres.
Never commit real values — `.env*` files are git-ignored; `.env.example` documents the format.

### Database & migrations

* Schema: `src/server/db/schema.ts` (Drizzle). SQL migrations: `drizzle/`.
* Migrations run automatically on every Vercel build (`npm run vercel-build`).
* Manually: `DATABASE_URL=… npm run db:migrate` (idempotent, safe to run concurrently).
* After changing the schema: `npm run db:generate` → commit the new file in `drizzle/`.

### Recurring movements without an always-on server

Due occurrences are generated (idempotently) when the user opens the app, and by a daily
Vercel Cron job (`vercel.json` → `/api/cron/recurring`, 04:15 UTC, allowed on the Hobby plan).
A unique constraint on `(recurring_id, occurrence_date)` guarantees an occurrence is never
created twice.

## Local development

Requirements: Node 22, a Postgres database (local Postgres 16 or a Neon development branch).

```bash
npm install
cp .env.example .env.local        # set DATABASE_URL (and CRON_SECRET)
npm run db:migrate
npm run dev                       # http://localhost:3000
```

## Tests

```bash
npm run lint && npm run typecheck
npm test                 # unit + integration (needs Postgres; TEST_DATABASE_URL, default local finances_test)
npm run build && npm run test:e2e   # Playwright against the production build (E2E_DATABASE_URL, default local finances_e2e)
E2E_BASE_URL=https://<preview>.vercel.app npm run test:e2e   # run the E2E suite against a deployment
```

* **Unit** (`tests/unit`): money parsing/formatting (no float errors), dates & leap years, balances,
  transfers, liquid wealth, cash flow, budgets, spending projection, recurring schedules,
  net-worth history, chart scales, translation completeness, validation.
* **Integration** (`tests/integration`, real Postgres): sign-up/password hashing, sessions
  (expiry, renewal, logout), rate limiting, CRUD, balances, net worth, budgets, analytics,
  user isolation (service and database level), recurring idempotency under concurrency, demo data
  removal that keeps real data, persistence across a new connection pool.
* **E2E** (`tests/e2e`, Chromium, phone viewport): the full journey — sign up, create accounts,
  income, expense, transfer, balances, net worth, budget, exceed budget, edit, delete, switch
  language, reload, log out, log in, data still there — plus HTTP security checks and layout
  checks (no horizontal overflow, visible tab labels, sheet fits, touch targets) at
  320×667, 360×800, 375×812, 390×844, 414×896, 430×932, 1366×768, 1440×900 and 1920×1080.

CI (`.github/workflows/ci.yml`) runs all of it with a Postgres service on every push.

## Project structure

```
src/
  app/                 routes (App Router)
    (auth)/            login, signup
    (app)/             authenticated screens (session checked server-side in layout.tsx)
    api/               Route Handlers = Vercel Functions (JSON API)
  components/
    ui/                design-system primitives (Button, Card, Sheet, Field, Toast…)
    charts/            lightweight SVG charts (donut, bars, area)
    forms/             movement / account sheets, pickers, amount input
    shell/             app shell: tab bar, sidebar, header, month switcher, sheets
    views/             one component per screen
  hooks/               React Query data hooks, formatting hooks
  lib/                 shared, framework-free code
    finance/           balances, cash flow, budgets, projection, recurring, net worth
    i18n/              dictionaries (ca, es, en) + typed translator
    money.ts dates.ts  exact money and calendar helpers
    validation.ts      Zod schemas shared by forms and API
  server/              server-only code: db (Drizzle schema), auth, services, HTTP helpers
drizzle/               SQL migrations
tests/                 unit, integration, e2e
```

## Security

* Passwords hashed with scrypt; sessions are opaque random tokens (only their SHA-256 is stored),
  `HttpOnly` + `Secure` + `SameSite=Lax` cookies, 30-day sliding expiry.
* Every query is scoped by the user id from the session; the database enforces it again with
  composite foreign keys, so rows can never reference another user's account or category.
* Same-origin check on all mutating requests, DB-backed rate limiting for login/sign-up,
  `Cache-Control: no-store` on all API responses, security headers.
* `src/server/**` is `server-only`; no secret reaches the browser.

## Visual design

The UI follows a clean, card-based mobile layout (Inter, emerald accent, rounded 20 px cards,
bottom tab bar). All colours, radii and shadows are tokens in `src/app/globals.css`
(`@theme`), so the look can be aligned with the Base44 reference screenshots in one place.
