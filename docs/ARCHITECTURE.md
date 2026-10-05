# Architecture

This document records the technical decisions taken **before** writing the application, and why each
one is compatible with Vercel and with a mobile-first product.

## 1. Constraints that drive everything

| Requirement | Consequence |
| --- | --- |
| Runs on Vercel | No long-lived process, no writable/persistent filesystem, no in-memory state between requests. Every request is stateless. |
| Data must persist forever | An external managed database. Nothing financial in files, memory or `localStorage`. |
| Mobile first | Small JS bundle, app-like navigation (bottom tabs, bottom sheets), large touch targets, safe areas, installable PWA. |
| Personal finance | Exact money arithmetic (integer cents), strict per-user isolation, server-side validation. |

## 2. Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16 (App Router) + React 19 + TypeScript** | First-class on Vercel (zero config). Pages and API live in one project; API routes deploy as Vercel Functions. |
| Database | **Neon Postgres** (installed from the Vercel Marketplace, "Storage → Neon") | Managed, persistent, serverless Postgres. Vercel injects `DATABASE_URL` automatically. Postgres gives us real constraints, transactions and `date` types. |
| DB access | **Drizzle ORM + `pg` (node-postgres) Pool** | Typed queries, SQL migrations committed to git. The pool is registered with `attachDatabasePool` from `@vercel/functions`, which is Vercel's recommended way to use connection pools with Fluid compute (idle connections are released before a function instance is suspended). Runtime traffic goes through Neon's **pooled** endpoint. |
| Auth | **Own session auth** (scrypt password hashes + opaque session tokens stored hashed in Postgres, `HttpOnly` cookie) | No external auth service or extra secret. Sessions live in the database, so they survive redeploys and cold starts. |
| API | **Route Handlers** under `src/app/api/**` (Node.js runtime) | Each handler is a stateless function: read cookie → validate session in DB → run a user-scoped query. |
| Client data | **TanStack Query** | Caching, deduplication and invalidation on the phone, so switching tabs is instant and the DB isn't hit repeatedly. |
| Styling | **Tailwind CSS v4** with design tokens in CSS variables | Small CSS output, tokens make it easy to align with the Base44 visual reference. |
| Icons | **lucide-react** (tree-shaken) | Same icon family Base44 prototypes use. |
| Charts | **Hand-written SVG components** | The four chart shapes we need (donut, bars, grouped bars, area) cost a few KB instead of ~100 KB for a chart library. |
| Validation | **Zod** schemas shared by client forms and API handlers | One definition of what a valid movement/account/budget is. |
| i18n | Small typed dictionary system (ca / es / en) + `Intl` for dates, numbers and currency | All UI text comes from dictionaries; TypeScript fails the build if a key is missing in a language. |
| Tests | **Vitest** (unit + integration against a real Postgres) and **Playwright** (E2E + mobile viewport/overflow checks) | |

### Why not ...

* **SQLite / JSON files** – the Vercel filesystem is read-only and ephemeral. Ruled out by design.
* **A separate Express/Nest server** – would need a process that stays alive. Route Handlers do the same job as Vercel Functions.
* **Neon HTTP driver** – no interactive transactions, which we need for idempotent recurring generation and demo-data removal. `pg` over the pooled endpoint supports them and also works against any local Postgres for tests.
* **Recharts/Chart.js** – big bundle for a phone; our charts are simple.

## 3. Request lifecycle (serverless)

```
Phone ──HTTPS──▶ Vercel Edge ──▶ Vercel Function (Route Handler / Server Component)
                                   │ 1. read `fin_session` cookie
                                   │ 2. SELECT session JOIN user WHERE id = sha256(token) AND expires_at > now()
                                   │ 3. run query scoped by user_id from the session (never from the client)
                                   ▼
                                Neon Postgres (pooled endpoint)
```

Nothing is kept in memory between requests except the connection pool, which is only an optimisation
(Fluid compute may reuse an instance; if it doesn't, a new pool is created).

## 4. Data model

All money columns are `bigint` **integer cents**. Calendar dates are Postgres `date` (no time zone
ambiguity). Every financial table carries `user_id`.

```
users            id, email (unique), password_hash, name, locale, currency, timezone
sessions         id = sha256(token), user_id → users, expires_at
rate_limits      key, count, window_start               (login/sign-up throttling)
accounts         id, user_id, name, type, initial_balance_cents, initial_balance_date,
                 currency, is_liquid, color, archived_at, is_demo
categories       id, user_id, key (built-in), name (custom), kind (expense|income),
                 group (needs|lifestyle|other|income), icon, color, archived_at
transactions     id, user_id, type (expense|income|transfer), amount_cents > 0, date,
                 account_id, to_account_id, category_id, description, notes,
                 recurring_id, occurrence_date, is_demo
recurring_transactions
                 id, user_id, type, amount_cents, account_id, to_account_id, category_id,
                 description, frequency (weekly|monthly|yearly), interval, start_date,
                 end_date, last_generated_date, is_active, is_demo
budgets          id, user_id, category_id (NULL = overall monthly budget), amount_cents, is_demo
```

Integrity is enforced **in the database**, not only in code:

* Composite foreign keys `(account_id, user_id) → accounts(id, user_id)` (same for destination
  account, category and recurring rule). A row can never point to another user's account or category,
  even if application code had a bug.
* `CHECK` constraints: amount > 0; a transfer has a destination different from its source and no
  category; income/expense always have a category and no destination.
* `UNIQUE (recurring_id, occurrence_date)` makes it impossible to generate the same scheduled
  occurrence twice, even with concurrent requests (inserts use `ON CONFLICT DO NOTHING`).
* `UNIQUE (user_id, category_id) NULLS NOT DISTINCT` on budgets: one overall budget and one budget per
  category.

**MonthlySnapshot is intentionally not stored.** Historical balances are *derived* from
`initial balance + movements up to date D`. A stored snapshot would become wrong as soon as the user
edits an old movement, and at personal-finance scale (thousands of rows) the aggregation runs in
milliseconds in Postgres. The `/api/net-worth` endpoint returns the reconstructed series.

## 5. Finance rules (single source of truth: `src/lib/finance`)

* **Cash flow** = income and expenses only. Transfers never count as income or expense.
* **Account balance (as of D)** = initial balance (if `initial_balance_date ≤ D`) + income − expenses −
  outgoing transfers + incoming transfers, counting movements dated ≤ D.
* **Liquid wealth (as of D)** = Σ balances of accounts with `is_liquid = true`. A transfer between two
  liquid accounts leaves it unchanged; a transfer to a non-liquid account reduces it.
* **Monthly balance** = income − expenses for the month (negative → "you spent more than you earned").
* **Spending projection** (current month only, hidden during the first 5 days):
  `fixed + variable / days_elapsed × days_in_month`, where *fixed* are expenses generated by recurring
  rules (they happen once a month and must not be extrapolated). Without recurring rules this is
  exactly `spent / days_elapsed × days_in_month`.
* **Budgets**: standing monthly limits (overall and per category). ≥ 80 % → warning, > 100 % →
  exceeded. Budgets never block saving a movement.

## 6. Recurring movements without a server that stays alive

1. **Lazy catch-up**: when a signed-in user opens the app, the server generates any due occurrences up
   to *today in the user's time zone* before loading data.
2. **Vercel Cron** (`vercel.json`, daily) calls `/api/cron/recurring` (protected by `CRON_SECRET`) to
   materialise occurrences for every user, even those who didn't open the app.
3. Both paths call the same idempotent function; the unique constraint guarantees no duplicates.
   Monthly rules on day 29–31 are clamped to the last day of shorter months (leap years included).

## 7. Security

* Passwords: `scrypt` (N=2¹⁵, r=8, p=1, 16-byte salt), compared in constant time. Never stored or logged in plaintext.
* Sessions: 32 random bytes, only the SHA-256 hash is stored. Cookie is `HttpOnly`, `Secure` (prod),
  `SameSite=Lax`, 30-day sliding expiry. Logout deletes the row.
* Mutating API calls require a same-origin `Origin` header (CSRF defence in depth on top of SameSite).
* Login/sign-up throttling per email+IP stored in Postgres (works across serverless instances).
* Every query is scoped by the session's `user_id`; IDs from the client are only used together with it.
* Secrets only in environment variables; `src/server/**` imports `server-only` so it can never be bundled
  for the browser.

## 8. Mobile-first UI

* Layout designed at 320–430 px first; desktop (≥ 1024 px) adds a sidebar and multi-column grids.
* Bottom tab bar (Dashboard, Movements, Analytics, Net worth, Budget) + floating "+" button; Settings in
  the header. Respects `env(safe-area-inset-*)`.
* Add/edit movement is a bottom sheet (native `<dialog>`, so focus trapping and Escape are built in),
  with a big decimal amount field, category tiles and account chips — no typing beyond the amount.
* The sheet tracks `visualViewport` so the Save button stays above the iOS/Android keyboard.
* Inputs are ≥ 16 px (no iOS zoom), touch targets ≥ 44 px, no hover-only interactions.
* PWA: web manifest, icons (incl. maskable & Apple touch icon), `standalone` display, theme colour, and a
  minimal service worker that only provides an offline page (financial data is never cached offline).

## 9. Internationalisation

* Catalan (default), Spanish, English. Dictionaries in `src/lib/i18n/messages/*`; `ca` and `es` are typed
  against `en`, so a missing key is a compile error.
* Language preference: cookie (for server rendering without flicker) + `users.locale` in the database
  (follows the user across devices).
* `Intl.NumberFormat` / `Intl.DateTimeFormat` with `ca-ES`, `es-ES`, `en-GB`; currency EUR by default.
* The API returns error **codes**, translated on the client.

## 10. Deployment

* `vercel.json` sets the build command to `npm run vercel-build` = run pending SQL migrations (guarded by
  a Postgres advisory lock, using the unpooled URL when available), then `next build`.
* Cron job for recurring movements.
* Required env: `DATABASE_URL` (added automatically by the Neon integration). Recommended: `CRON_SECRET`.
  See `README.md` and `.env.example`.
