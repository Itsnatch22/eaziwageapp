# Rollback Runbook

*Last verified 2026-07-08. This document exists because there was previously no documented rollback plan at all — a bad deploy would have left whoever was on call improvising for the first time during an incident.*

## What actually exists today

- **No feature-flag system.** No LaunchDarkly/GrowthBook/Unleash, nothing custom. A shipped bug is live for every user immediately — there is no kill switch short of a full rollback.
- **No custom deploy pipeline or `vercel.json`.** Deployment is Vercel's default: push to `main` → Vercel builds and promotes to production automatically.
- **The only real rollback mechanism is Vercel's own dashboard.** Every previous deployment stays available as an immutable build. Rolling back means re-promoting an older one — it does not touch git history and does not require a new build.

## Step 1: Decide if this is actually a rollback situation

Roll back if the bad deploy is:
- Causing 500s / broken pages for real users right now, or
- A money-integrity risk (wrong disbursement amounts, broken repayment logic, auth bypass)

Don't roll back (fix forward instead) if:
- The bug is cosmetic / low-traffic-page-only, or
- The last deploy included a **database migration that later commits depend on**. Rolling back the app code while the new schema stays in place can be *worse* than the original bug — check `supabase/migrations/` for anything applied in the same window before you decide (see Step 4).

## Step 2: Roll back the app (Vercel)

1. Vercel dashboard → EaziWage project → **Deployments**.
2. Find the last known-good deployment (the one immediately before the bad one).
3. Click **"..." → Promote to Production** (this is Vercel's instant rollback — no rebuild, takes effect in seconds).
4. Confirm. Traffic now serves the previous build.

If you don't have dashboard access in the moment, `git revert <bad-commit-sha> && git push origin main` triggers a normal new deploy of the reverted code — slower (full build), but works from a terminal alone.

## Step 3: Confirm the rollback actually fixed it

- Hit `/api/ping` (returns `{ ok: true, commit: "<VERCEL_GIT_COMMIT_SHA>", timestamp: "..." }`) and one authenticated page per role (admin/employer/employee) to confirm the active deployment SHA matches the expected rolled-back build.
- Check `/status` (public status page) and `/admin/api-health` for the current health snapshot.
- Watch `admin_notifications` / your alert email for the next 15 minutes (the `sync-health.yml` health check runs every 15 min and will notify on a real down/degraded state — see `app/api/admin/check-api-health/route.ts`).

## Step 4: The database migration problem

**Supabase migrations are not automatically rolled back by a Vercel rollback** — they're applied directly to the live project (per `CLAUDE.md`: "Schema is managed directly against the live project"). If the bad deploy included a migration:

1. Check `supabase/migrations/` for anything with a timestamp matching the bad deploy's merge window.
2. If the old app code is *compatible* with the new schema (e.g. you only added a nullable column), rolling back the app alone is safe.
3. If the old app code is *not* compatible (e.g. a column it reads was renamed/dropped), you need a **forward-fix migration** that restores the old shape (or a compatibility view) — do not attempt to hand-write a migration revert under pressure; write the smallest migration that makes the old app code work again, verify it against the live schema via the Supabase MCP first, exactly as documented in `CLAUDE.md`'s "DB changes" section.

## Step 5: Post-incident

- Add an entry describing what broke and why to this file's "Past incidents" section below (keep it short — this is a runbook, not a postmortem doc).
- If the root cause is something this runbook should have caught earlier (e.g. "we didn't check for pending migrations"), update Step 4 rather than relying on memory next time.

## Past incidents

*(none logged yet)*
