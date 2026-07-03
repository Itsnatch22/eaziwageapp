-- Backs the sync-stats.yml cron (runs every 15 min, calls
-- /api/internal/sync-stats), which has been failing with 42P01/PGRST205
-- since this table was never created. Nothing reads it yet — /api/public/stats
-- (the landing page's real stats source) computes everything live on every
-- request instead. Creating this as a proper read-through cache; see the
-- companion code change wiring /api/public/stats to prefer it.
CREATE TABLE public.public_stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total_users INTEGER NOT NULL DEFAULT 0,
  active_employers INTEGER NOT NULL DEFAULT 0,
  active_employees INTEGER NOT NULL DEFAULT 0,
  total_disbursed NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT public_stats_singleton CHECK (id = 1)
);

ALTER TABLE public.public_stats ENABLE ROW LEVEL SECURITY;

-- Public/anonymous reads (this is what powers the public landing page),
-- writes restricted to service-role (the cron route uses supabaseAdmin).
CREATE POLICY public_stats_public_select ON public.public_stats
  FOR SELECT
  USING (true);
