# Mukhero Digital

**The business manager for people who import online and sell locally.**

A new generation of _mukheristas_ no longer crosses the border to buy: they order from AliExpress,
Alibaba, Shein, Temu and Amazon, ship through a cargo agent, and resell on WhatsApp, Facebook,
Instagram and TikTok. The trade has gone digital, but the back office still lives in chat threads,
notebooks and memory. Mukhero Digital turns the journey from "add to cart" abroad to "paid" in
Maputo into one simple flow: record every purchase, know what is in stock, sell anywhere, and see
where every metical goes.

> **Vision:** every digital mukherista runs a profitable, organised import business from their phone.

It is not a marketplace or a generic inventory app. It is built around the four records a
mukherista runs on: **purchases, stock, sales and expenses**, which feed one view of profit.

## The problem

- **Real cost is a guess.** Item price, shipping, fees and the USD/ZAR/CNY → MZN rate are rarely
  added up, so sellers price by feel and lose margin without knowing it.
- **Purchases are scattered** across marketplace apps and emails.
- **Customers wait in the dark.** Pre-orders and deposits (_sinal_) are tracked in WhatsApp; buyers
  keep asking "já chegou?".
- **Cash is invisible.** Money sits in goods in transit, customer balances (_fiado_) and unsold
  stock, while daily expenses (transport, data, rent) go unrecorded.

## Who it's for

| Segment                           | Who they are                                                               | What they need most                                       |
| --------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Digital mukheristas** (primary) | Solo or two-person sellers of clothing, beauty, phone accessories, gadgets | Landed cost and pricing, pre-orders, customer balances    |
| **Growing importers**             | Shops and boutiques buying in bulk on Alibaba / 1688, 1–5 staff            | Stock across locations, staff access, supplier history    |
| **Group-buy organisers**          | Collect orders from many buyers and ship together                          | Splitting purchase and shipping cost, collecting deposits |
| **Partners** (secondary)          | Mobile money providers, microfinance lenders                               | A reliable sales and stock record to lend against         |

_Persona — Neusa, 27, Maputo._ Orders clothes and wigs from Shein and AliExpress every two weeks via
an air cargo agent and sells to ~150 WhatsApp contacts. She takes deposits on pre-orders, tracks
everything in chats and a notebook, and is never sure if last month was profitable.

## Product principles

1. **Mobile first, WhatsApp native.** The phone is the shop; sharing to WhatsApp is a core action.
2. **True cost and profit, always.** Every product shows what it really cost to put on the shelf and
   the margin at each price.
3. **Works on weak networks.** Offline entry, light data use, sync when connected.
4. **Speaks the seller's language.** Portuguese first (pt-MZ), local terms (mukhero, fiado, sinal),
   MZN as home currency.
5. **Money moves the local way.** Cash, M-Pesa, e-Mola and mKesh as first-class payment methods.

## Scope

- Marketplace orders are entered by hand through a quick purchase form; each purchase enters stock
  at its item cost and each sale draws stock down (FIFO).
- Shipping and shared fees are recorded as expenses and can be linked to the products or purchases
  they relate to, so profit per product stays accurate.
- Every account is a separate business (multi-tenant) with its own users and roles, so an owner can
  add sellers without sharing a password or exposing costs.
- Formal invoices are an optional switch; everyone else gets a simple receipt.
- **Out of scope:** cargo agents, parcel tracking and customs.

**Business model.** Freemium: free up to a set number of active orders per month; a low monthly plan
in MZN, paid by M-Pesa or e-Mola, unlocks unlimited orders, reports and catalogue sharing.

**Success metrics.** Weekly active sellers · purchases and sales logged per seller per month · share
of products with a full unit cost · free-to-paid conversion and 90-day retention · seller-reported
change in margin after three months.

---

## Development

The UI was implemented from the `Lote App v4` Claude Design prototype.

### Stack

React 19 · Vite 8 · TypeScript (strict) · React Router 8 (lazy routes) · Supabase · TanStack Query 5 · Zustand 5 ·
React Hook Form + Zod 4 · Tailwind CSS 4 · Vitest 5 + Testing Library · oxlint · Prettier

### Scripts

| Command                                                     | What it does                             |
| ----------------------------------------------------------- | ---------------------------------------- |
| `npm run dev`                                               | Dev server                               |
| `npm run dev:demo`                                          | Dev server with in-memory backend        |
| `npm run build`                                             | Typecheck + production build             |
| `npm run check`                                             | Typecheck + lint (warnings fail) + tests |
| `npm test` / `npm run test:watch` / `npm run test:coverage` | Vitest                                   |
| `npm run lint` / `npm run format`                           | oxlint / Prettier                        |

### Structure

```
src/
  domain/      Pure business logic, no React: types, derivations (landed cost, FIFO stock),
               analytics (ranges, buckets), mutations, Zod schemas, Excel export, defaults
  store/       Zustand: appStore (persisted to localStorage "lote.app.v4"), uiStore, filtersStore
  hooks/       OrgDataProvider (derived data computed once), useMutate, useEntrance, useMediaQuery
  components/  UI kit (Button, Field, Combobox, Menu, Segmented…), DataTable, overlays (Sheet, Confirm, Toast, Preview)
  features/    Pages (auth, orgs, dashboard, stock, sales, expenses, reports, settings), filter bar, modal forms
  lib/         Dependency-free .xlsx writer, file helpers
```

Mutations are pure `(OrgData) => OrgData | Result` functions; UI calls them via `useMutate()`,
which surfaces `Result` errors as toasts. Forms keep numeric inputs as strings and let the Zod
schema parse/validate them, so errors are specific ("Indique o valor", "Stock insuficiente…").

### Backend (Supabase)

```bash
cp .env.example .env.local          # then paste the anon key printed below
npm run db:start                    # local Supabase in Docker (applies migrations)
npm run db:types                    # regenerate src/lib/database.types.ts from the schema
npm run db:test                     # pgTAP tests: RLS, roles, FIFO sales, invites
npm run dev                         # app against local Supabase
npm run dev:demo                    # app against an in-memory backend, no Supabase needed
```

In development the sign-in page also offers email + password sign-in.

**Google sign-in:** create an OAuth client in Google Cloud (redirect URI
`http://127.0.0.1:54321/auth/v1/callback` locally), put `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and
`SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` in `supabase/.env`, and set `enabled = true` under
`[auth.external.google]` in `supabase/config.toml`.

### Data model

- `supabase/migrations/` — tables, row-level security, and database functions. Every row carries
  `org_id` (one org = one business); access goes through `private.has_role()`.
- Roles: **Admin** everything · **Vendas** sales, expenses, attachments, new expense categories ·
  **Stock** products, prices, lots · **Leitura** read-only. Voiding sales and deleting records is Admin-only.
- Multi-step rules run in the database: `record_sale` (FIFO across lots with row locks — concurrent
  sellers can't oversell), `create_lot` (sequential codes), `invite_member`, `request_join` (by org
  join code), `accept_invite`, last-admin protection. "Esgotado" is derived, never stored.
- Attachments live in the private `attachments` bucket under `<org_id>/…` (≤ 3 MB) and are opened
  with short-lived signed URLs.
- Client: `src/api/types.ts` defines the `Api` contract; `supabaseApi` implements it, `memoryApi`
  implements it in memory (used by UI tests and `dev:demo`). TanStack Query caches server state.
