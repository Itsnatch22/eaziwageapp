create table public.legal_documents (
  id uuid not null default gen_random_uuid (),
  document_type text not null,
  title text not null,
  content text not null,
  version text not null,
  effective_date timestamp with time zone not null,
  is_active numeric not null default '1'::numeric,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint legal_documents_pkey primary key (id),
  constraint legal_documents_document_type_check check (
    (
      document_type = any (
        array[
          'employee_terms'::text,
          'employer_partnership'::text,
          'privacy_policy'::text
        ]
      )
    )
  ),
  constraint legal_documents_is_active_check check (
    (
      is_active = any (array[(0)::numeric, (1)::numeric])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_legal_documents_effective on public.legal_documents using btree (effective_date) TABLESPACE pg_default;

create index IF not exists idx_legal_documents_effective_date on public.legal_documents using btree (effective_date desc) TABLESPACE pg_default;

create index IF not exists idx_legal_documents_is_active on public.legal_documents using btree (is_active) TABLESPACE pg_default
where
  (is_active = (1)::numeric);

create index IF not exists idx_legal_documents_type on public.legal_documents using btree (document_type) TABLESPACE pg_default;

create index IF not exists legal_docs_type_idx on public.legal_documents using btree (document_type) TABLESPACE pg_default;

create trigger legal_documents_updated_at BEFORE
update on legal_documents for EACH row
execute FUNCTION update_updated_at ();