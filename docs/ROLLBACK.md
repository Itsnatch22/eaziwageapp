# Rollback Runbook

*Code paths last verified 2026-10-24. Vercel project settings and live Supabase migration state are not verified by this document.*

## What actually exists today

- **No app-level feature-flag or kill-switch system was found in the code.** A targeted operational control may still exist outside the repository; verify before assuming a full rollback is the only mitigation.
- **The repository documents Vercel deployment, but contains no `vercel.json` or GitHub deployment workflow.** Whether pushes to `main` automatically deploy to production depends on the Vercel project settings and must be confirmed there.
- **For a Vercel deployment, use the Vercel dashboard to promote a known-good deployment.** Confirm the project's deployment/rollback options and the target deployment before changing production traffic; this does not alter Git history.

## Step 1: Decide if this is actually a rollback situation

Roll back if the bad deploy is:

- Causing 500s / broken pages for real users right now, or
- A money-integrity risk (wrong disbursement amounts, broken repayment logic, auth bypass)

Prefer fixing forward rather than rolling back if:

- The bug is cosmetic / low-traffic-page-only, or
- The deploy may depend on a **database migration**. Rolling back app code while retaining an incompatible schema can be worse than the original bug — verify the live schema and migration history before deciding (see Step 4).

## Step 2: Roll back the app (Vercel)

1. Vercel dashboard → EaziWage project → **Deployments**.
2. Find and verify the last known-good deployment.
3. Use the deployment's **Promote to Production** action if available, and confirm the target before applying it.
4. Confirm. Traffic now serves the previous build.

If dashboard access is unavailable, `git revert <bad-commit-sha>` followed by pushing to the configured production branch can deploy a revert, provided that branch is connected to production in Vercel. This creates a new deployment and does not guarantee an immediate rollback.

## Step 3: Confirm the rollback actually fixed it ✅

- Hit `/api/ping` (returns `{ ok: true, commit: "<VERCEL_GIT_COMMIT_SHA>", timestamp: "..." }`) and confirm its commit matches the expected deployment. Visit an authenticated page for each role (admin/employer/employee) to check that those areas load.
- Check `/status` (public status page) and `/admin/api-health` (admin-only page) for the health snapshot.
- The `.github/workflows/sync-health.yml` workflow is scheduled every 15 minutes. The health-check route sends an admin notification when an unhealthy state is first recorded or its severity increases; it does not repeat an alert on every run. Check the health page, notifications, and logs rather than treating the absence of a repeat alert as recovery.

## Step 4: The database migration problem

**A Vercel rollback does not roll back the Supabase schema.** The local `supabase/migrations/` folder is not authoritative, and may contain migration files that have not been applied. If the bad deploy may have included a database change:

1. Verify the actual Supabase project's migration history and schema; a migration file in the repository does not prove it was applied.
2. If the old app code is compatible with the live schema (for example, the change only added a nullable column), rolling back the app alone may be safe.
3. If the old app code is incompatible with the live schema (for example, a column it reads was renamed or dropped), prepare a **forward-fix migration** or compatibility change. Do not improvise a migration reversal under pressure; verify any proposed SQL against the actual schema and test it in staging first.

## Step 5: Post-incident

- Add an entry describing what broke and why to this file's "Past incidents" section below (keep it short — this is a runbook, not a postmortem doc).
- If the root cause is something this runbook should have caught earlier (e.g. "we didn't check for pending migrations"), update Step 4 rather than relying on memory next time.
*(none logged yet)*
