# Mukhero Digital

Stock, import lots, sales, expenses and P&L for small importers — implemented from the
`Lote App v4` Claude Design prototype. UI language is Portuguese (pt-MZ).

## Stack

React 19 · Vite 8 · TypeScript (strict) · React Router 8 (lazy routes) · Supabase · TanStack Query 5 · Zustand 5 ·
React Hook Form + Zod 4 · Tailwind CSS 4 · Vitest 5 + Testing Library · oxlint · Prettier

## Scripts

| Command                                                     | What it does                             |
| ----------------------------------------------------------- | ---------------------------------------- |
| `npm run dev`                                               | Dev server                               |
| `npm run build`                                             | Typecheck + production build             |
| `npm run check`                                             | Typecheck + lint (warnings fail) + tests |
| `npm test` / `npm run test:watch` / `npm run test:coverage` | Vitest                                   |
| `npm run lint` / `npm run format`                           | oxlint / Prettier                        |

## Structure

```
src/
  domain/      Pure business logic, no React: types, derivations (landed cost, FIFO stock),
               analytics (ranges, buckets), mutations, Zod schemas, Excel export, seeds
  store/       Zustand: appStore (persisted to localStorage "lote.app.v4"), uiStore, filtersStore
  hooks/       OrgDataProvider (derived data computed once), useMutate, useEntrance, useMediaQuery
  components/  UI kit (Button, Field, Combobox, Menu, Segmented…), DataTable, overlays (Sheet, Confirm, Toast, Preview)
  features/    Pages (auth, orgs, dashboard, stock, sales, expenses, reports, settings), filter bar, modal forms
  lib/         Dependency-free .xlsx writer, file helpers
```

Mutations are pure `(OrgData) => OrgData | Result` functions; UI calls them via `useMutate()`,
which surfaces `Result` errors as toasts. Forms keep numeric inputs as strings and let the Zod
schema parse/validate them, so errors are specific ("Indique o valor", "Stock insuficiente…").

## Backend (Supabase)

```bash
cp .env.example .env.local          # then paste the anon key printed below
npm run db:start                    # local Supabase in Docker (applies migrations + seed)
npm run db:types                    # regenerate src/lib/database.types.ts from the schema
npm run db:test                     # pgTAP tests: RLS, roles, FIFO sales, invites
npm run dev                         # app against local Supabase
npm run dev:demo                    # app against in-memory demo data, no backend needed
```

In development the sign-in page also offers email + password for the seeded demo users
(`carlos@bestsound.co.mz`, `ana@…`, `rui@…`, `lucia@casalumi.co.mz`; password `mukhero-demo`).
Regenerate the seed with `npm run db:seed:generate`.

**Google sign-in:** create an OAuth client in Google Cloud (redirect URI
`http://127.0.0.1:54321/auth/v1/callback` locally), put `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and
`SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` in `supabase/.env`, and set `enabled = true` under
`[auth.external.google]` in `supabase/config.toml`.

### Model

- `supabase/migrations/` — tables, row-level security, and database functions. Every row carries
  `org_id`; access goes through `private.has_role()`.
- Roles: **Admin** everything · **Vendas** sales, expenses, attachments, new expense categories ·
  **Stock** products, prices, lots · **Leitura** read-only. Voiding sales and deleting records is Admin-only.
- Multi-step rules run in the database: `record_sale` (FIFO across lots with row locks — concurrent
  sellers can't oversell), `create_lot` (sequential codes), `invite_member`, `request_join` (by org
  join code), `accept_invite`, last-admin protection. "Esgotado" is derived, never stored.
- Attachments live in the private `attachments` bucket under `<org_id>/…` (≤ 3 MB) and are opened
  with short-lived signed URLs.
- Client: `src/api/types.ts` defines the `Api` contract; `supabaseApi` implements it, `memoryApi`
  implements it in memory (used by UI tests and `dev:demo`). TanStack Query caches server state.

## Notes

- Demo data: _BestSound_ is imported from the original accounting spreadsheet; _Casa Lumi_ is synthetic.

## Local run
run npm run dev and sign in with a demo user (password mukhero-demo). Google sign-in still needs the OAuth client set up as described in the README.
API at http://127.0.0.1:54321, Studio at http://127.0.0.1:54323, Mailpit at http://127.0.0.1:54324