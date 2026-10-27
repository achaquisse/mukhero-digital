# Repository Guidelines

Mukhero Digital is a multi-tenant React 19 + Supabase business manager for online importers (purchases, stock, sales, expenses). UI copy and user-facing errors are Portuguese (pt-MZ); currency is MZN.

## Project Structure & Module Organization

- `src/domain/` — pure business logic, no React: types, derivations (landed cost, FIFO), analytics, Zod schemas, and mutations returning `Result = { ok: true; db } | { ok: false; error }`.
- `src/api/types.ts` defines the `Api` contract. `supabaseApi.ts` implements it against Supabase (rows mapped via `mappers.ts`); `memoryApi.ts` implements it in memory for tests and `dev:demo`. `src/main.tsx` picks the backend from `VITE_API`.
- `src/api/queries.ts` wraps TanStack Query; UI writes go through `useAction().run(api => ...)`, which toasts errors and invalidates org/me queries.
- `src/store/` — Zustand stores (session, ui, filters). `src/features/` — pages and modal forms; forms keep numeric inputs as strings and let Zod parse them.
- `supabase/migrations/` — schema, RLS (`private.has_role()`, every row has `org_id`), and RPCs like `record_sale` (FIFO with row locks) and `create_lot`. Multi-step rules belong in the database. "Esgotado" is derived, never stored.
- Runtime config: `src/lib/env.ts` reads `window.RUNTIME_ENV` (written by `docker/40-runtime-env.sh` at container start), falling back to `import.meta.env`.

## Build, Test, and Development Commands

- `npm run dev` / `npm run dev:demo` — Vite against local Supabase / in-memory backend.
- `npm run check` — typecheck + lint (warnings fail) + tests. Run before finishing.
- `npm test`, `npm run test:watch`, `npm run test:coverage`; single file: `npx vitest run src/domain/derive.test.ts`.
- `npm run db:start | db:reset | db:test | db:lint` — local Supabase, pgTAP tests in `supabase/tests/database/`.
- `npm run db:types` — regenerate `src/lib/database.types.ts` after any migration change; never hand-edit it.
- `npm run build` — `tsc -b && vite build`. Docker image builds via `Dockerfile` (nginx runtime); `compose.yaml` runs the published image.

## Coding Style & Naming Conventions

- **Prettier**: single quotes, `printWidth` 130, trailing commas.
- **oxlint** (`.oxlintrc.json`): no `any`, `consistent-type-imports` (use `import type`), `import/no-cycle`, no `console` except `warn`/`error`.
- **TypeScript** strict with `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `erasableSyntaxOnly` (no enums/namespaces).
- Tailwind CSS 4 for styling; React Router 8 lazy routes in `src/app/routes.tsx`.

## Testing Guidelines

Vitest + jsdom + Testing Library, tests colocated as `*.test.ts(x)`. UI tests render the full app with `src/test/renderApp.tsx` (memory API) and build data with `src/test/fixtures.ts`. Database behavior (RLS, roles, FIFO, invites) is tested with pgTAP.

## Commit & Pull Request Guidelines

Conventional-style prefixes: `feat: ...`, `fix: ...`, lowercase imperative summary. CI (`.github/workflows/docker.yml`) builds the multi-arch Docker image on PRs to `main` and pushes on `main`/`v*` tags.
