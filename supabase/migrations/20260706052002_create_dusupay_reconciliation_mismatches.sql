-- No automated job previously compared Supabase's advance ledger against
-- DusuPay's own transaction records at all — the only existing reconciliation
-- routes compare Supabase against itself, or against Stanbic's bank balance.
-- This table records disagreements found by the new reconciliation cron
-- (app/api/cron/reconcile-dusupay) for admin review — deliberately NOT
-- auto-corrected, since blindly overwriting based on whichever system was
-- checked last is exactly the bug being fixed in the verify route.
CREATE TABLE IF NOT EXISTS public.dusupay_reconciliation_mismatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id uuid NOT NULL REFERENCES public.advances(id) ON DELETE CASCADE,
  merchant_reference text NOT NULL,
  supabase_status text NOT NULL,
  dusupay_status text,
  dusupay_raw jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_dusupay_reconciliation_unresolved
  ON public.dusupay_reconciliation_mismatches (detected_at DESC)
  WHERE resolved = false;

ALTER TABLE public.dusupay_reconciliation_mismatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_reconciliation_mismatches" ON public.dusupay_reconciliation_mismatches
  FOR ALL
  USING (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'super_admin'::text]))
  WITH CHECK (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'super_admin'::text]));
