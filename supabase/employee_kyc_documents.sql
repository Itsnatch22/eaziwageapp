create table public.employee_kyc_documents (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  document_type text not null,
  document_number text null,
  expiry_date date null,
  storage_path text not null,
  document_url text not null,
  status text not null default 'pending'::text,
  reviewer_notes text null,
  reviewed_at timestamp with time zone null,
  reviewed_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint employee_kyc_documents_pkey primary key (id),
  constraint employee_kyc_documents_user_type_unique unique (user_id, document_type),
  constraint employee_kyc_documents_reviewed_by_fkey foreign KEY (reviewed_by) references auth.users (id),
  constraint employee_kyc_documents_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint employee_kyc_documents_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'under_review'::text,
          'approved'::text,
          'rejected'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_ekd_user_id on public.employee_kyc_documents using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_ekd_status on public.employee_kyc_documents using btree (status) TABLESPACE pg_default;

create index IF not exists idx_ekd_document_type on public.employee_kyc_documents using btree (document_type) TABLESPACE pg_default;

create trigger employee_kyc_documents_updated_at BEFORE
update on employee_kyc_documents for EACH row
execute FUNCTION update_updated_at ();