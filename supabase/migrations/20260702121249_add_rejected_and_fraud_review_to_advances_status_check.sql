ALTER TABLE advances DROP CONSTRAINT advances_status_check;
ALTER TABLE advances ADD CONSTRAINT advances_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'repaid'::text, 'completed'::text, 'failed'::text, 'disbursed'::text, 'processing'::text, 'rejected'::text, 'fraud_review'::text]));
