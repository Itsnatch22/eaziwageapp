create table public.communications (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  title text not null,
  content text not null,
  status text not null default 'draft'::text,
  sender_id uuid null,
  created_at timestamp with time zone null default now(),
  sent_at timestamp with time zone null,
  constraint communications_pkey primary key (id),
  constraint communications_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint communications_sender_id_fkey foreign KEY (sender_id) references auth.users (id) on delete set null,
  constraint communications_status_check check (
    (status = any (array['draft'::text, 'sent'::text]))
  )
) TABLESPACE pg_default;