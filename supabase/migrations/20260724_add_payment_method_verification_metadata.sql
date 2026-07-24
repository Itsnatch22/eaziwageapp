-- Add verification metadata and checksum for payment method document uploads
BEGIN;

ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS verification_metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_document_hash text;

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_methods_verification_status ON public.payment_methods (method_type, verification_status);
CREATE INDEX IF NOT EXISTS idx_payment_methods_verification_hash ON public.payment_methods (verification_document_hash);

-- Audit table for verification actions
CREATE TABLE IF NOT EXISTS public.payment_method_verification_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  admin_id uuid,
  action text NOT NULL,
  notes text,
  checksum text,
  document_path text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_verification_audit_pm_id ON public.payment_method_verification_audit (payment_method_id);

COMMIT;
