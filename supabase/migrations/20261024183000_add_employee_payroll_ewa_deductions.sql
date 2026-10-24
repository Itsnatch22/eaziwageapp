-- Preserve the uploaded deduction amount separately from the calculated
-- employee-specific EWA amount. This migration does not mark advances repaid:
-- payroll upload records a calculation, not a completed salary transfer.

ALTER TABLE public.payroll_upload_rows
  ADD COLUMN IF NOT EXISTS uploaded_deductions numeric,
  ADD COLUMN IF NOT EXISTS ewa_deduction numeric;

ALTER TABLE public.payroll_uploads
  ADD COLUMN IF NOT EXISTS ewa_reviewed_at timestamptz;

UPDATE public.payroll_upload_rows
SET uploaded_deductions = COALESCE(uploaded_deductions, deductions, 0),
    ewa_deduction = COALESCE(ewa_deduction, 0);

ALTER TABLE public.payroll_upload_rows
  ALTER COLUMN uploaded_deductions SET DEFAULT 0,
  ALTER COLUMN uploaded_deductions SET NOT NULL,
  ALTER COLUMN ewa_deduction SET DEFAULT 0,
  ALTER COLUMN ewa_deduction SET NOT NULL;
