# Jirella Farm Management System

Modular monolith for farm operations with Supabase (Postgres + Auth) and Next.js.

## What this project includes

- Auth and role-based access via Supabase Auth + RLS
- Inventory and store management
- Feed mill module (recipes, production, transfers)
- Poultry module (daily logs, expenses, internal feed purchase)
- BSF module (insectorium + larvarium + processing)
- Catfish module (ponds, batches, feed logs, harvests)
- Activity logging and sales ledgering

## Tech stack

- Next.js (App Router), React, TypeScript
- Supabase (@supabase/ssr, @supabase/supabase-js)
- Tailwind CSS, shadcn/ui, AG Grid
- PostgreSQL schema managed by SQL scripts in `sql/`

## Supabase dependency (important)

This project depends on Supabase features:

- `auth.users`, `auth.uid()` and `authenticated` role
- RLS policies across tables
- Supabase Auth for sessions and user management

Plain Postgres without Supabase Auth will not run the SQL or app without rework.

## Environment variables

Set these in `.env.local` (do not commit secrets):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Database setup

SQL scripts are idempotent and safe to rerun in order. Recommended order:

1. `sql/00_core.sql`
2. `sql/10_store.sql`
3. `sql/30_poultry.sql`
4. `sql/20_feed-mill.sql`
5. `sql/40_bsf.sql`
6. `sql/50_catfish.sql`

Notes:
- `sql/20_feed-mill.sql` contains a guarded backfill that only runs if
  `FeedInternalPurchase` exists (defined in `sql/30_poultry.sql`).
- `sql/40_bsf.sql` seeds BSF locations, products, and ingredients.
- `sql/50_catfish.sql` extends roles and module checks for CATFISH.

## Running locally

```powershell
npm install
npm run dev
```
## Deployment / Docker

The app can be containerized. Supabase can be:

- Hosted (point the app to the hosted project), or
- Self-hosted (run Supabase services alongside the app)

If you want a Dockerfile or compose setup, add it in `config/` or the repo root.

# Force workflow update
