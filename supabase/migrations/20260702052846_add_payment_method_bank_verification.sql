ALTER TABLE payment_methods
  ADD COLUMN verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending_review','approved','rejected')),
  ADD COLUMN verification_document_path text,
  ADD COLUMN verification_notes text,
  ADD COLUMN verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN verified_at timestamptz;

-- Backfill: methods already verified via the existing OTP path (mobile money)
-- should reflect 'approved' here too, so the two verification mechanisms agree.
UPDATE payment_methods SET verification_status = 'approved' WHERE is_verified = true;
