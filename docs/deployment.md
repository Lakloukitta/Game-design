# Deployment (Vercel)

Trip Autopilot is a standard Next.js App Router app and deploys to Vercel without
code changes. The API routes use the Node.js runtime and are never statically
cached.

## 1. Supabase setup

1. Create a Supabase project.
2. Apply the migration `supabase/migrations/001_initial_schema.sql` via the SQL
   editor or the Supabase CLI / `psql`.
3. From Project Settings → API, note:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - A server secret key → `SUPABASE_SECRET_KEY`
     (or the legacy service-role key → `SUPABASE_SERVICE_ROLE_KEY`).

RLS is enabled with no public policies; only the server secret key can read or
write. Do **not** create anonymous policies for this MVP.

## 2. Duffel setup

1. In the Duffel dashboard, switch to **Test mode**.
2. Create a **Test** access token (`duffel_test_…`) → `DUFFEL_ACCESS_TOKEN`.
3. **Never** configure a live (`duffel_live_…`) token. The app refuses to run
   supplier operations with a non-test token.

## 3. Vercel environment configuration

In Vercel → Project → Settings → Environment Variables, set (Production and
Preview as needed):

- `DUFFEL_ACCESS_TOKEN` (Secret, test token only)
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (Secret) — or `SUPABASE_SERVICE_ROLE_KEY`
- Optional: `TRAVEL_APP_MOCK_MODE`, `NEXT_PUBLIC_TRAVEL_APP_MOCK_MODE`,
  `LOG_LEVEL`, `DUFFEL_WEBHOOK_SECRET`

Mark all privileged keys as **Secret**. Only `NEXT_PUBLIC_*` variables are
exposed to the browser — never put a privileged key in a `NEXT_PUBLIC_*` name.

## 4. Redeploy after environment changes

Environment variable changes only take effect on a **new deployment**. After
editing variables, trigger a redeploy (push a commit or use “Redeploy”).

## 5. Preview / test environments

- Preview deployments should use the **same** test Duffel token and a Supabase
  project you are comfortable populating with test data.
- A preview environment can run with `TRAVEL_APP_MOCK_MODE=true` to demo without
  any external dependencies.

## 6. Verifying the deployment

- Hit `GET /api/health` — expect `200` with `mockMode`, `databaseConfigured`,
  and `duffelConfigured` booleans (no secrets).
- Run the happy path from `docs/manual-testing.md`.

## 7. Verifying secrets are not exposed

- In the browser devtools, inspect the JS bundles and `window` — no Duffel token
  or Supabase secret should appear. Only `NEXT_PUBLIC_SUPABASE_URL` is present.
- `next build` performs **no** live supplier calls; mock fixtures are excluded
  from production unless mock mode is explicitly enabled.
- Search the deployed source maps (if enabled) for `duffel_` and your Supabase
  key prefix — there should be no matches.

## Prohibitions

- No live Duffel token, ever, in this MVP.
- No real card or passport data.
- No anonymous Supabase write policies.
