-- Consolidate advances.status onto canonical 'rejected', dropping the
-- duplicate 'denied' value. Verified 0 live rows used 'denied' before this
-- migration; all application code has been updated to write 'rejected' only.
ALTER TABLE public.advances DROP CONSTRAINT advances_status_check;
ALTER TABLE public.advances ADD CONSTRAINT advances_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'repaid'::text, 'completed'::text, 'failed'::text, 'disbursed'::text, 'processing'::text, 'rejected'::text, 'fraud_review'::text]));
