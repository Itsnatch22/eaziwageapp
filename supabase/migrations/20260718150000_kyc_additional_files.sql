-- Supporting-attachments model for multi-file KYC document types (financial
-- docs only — e.g. an employer attaching 3 months of bank statements or
-- several years of audited financials).
--
-- Deliberately does NOT touch the UNIQUE(user_id, document_type) constraint
-- or the recompute_*_onboarding_status() triggers: each document_type stays
-- exactly ONE reviewable line-item that counts once toward the required-N
-- total and carries one status (pending/approved/rejected). Extra files hang
-- off that row as supporting evidence in this jsonb array and never affect the
-- approval counting the account/KYC separation depends on.
--
-- Each element: { "url": text, "storage_path": text, "name": text,
--                 "uploaded_at": timestamptz-as-text }

ALTER TABLE public.employer_kyc_documents
  ADD COLUMN IF NOT EXISTS additional_files jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.employee_kyc_documents
  ADD COLUMN IF NOT EXISTS additional_files jsonb NOT NULL DEFAULT '[]'::jsonb;
