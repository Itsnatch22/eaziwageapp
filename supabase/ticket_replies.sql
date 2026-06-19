create table public.ticket_replies (
  id uuid not null default gen_random_uuid (),
  ticket_id uuid not null,
  sender_id uuid not null,
  sender_role text not null,
  message text not null,
  created_at timestamp with time zone null default now(),
  constraint ticket_replies_pkey primary key (id),
  constraint ticket_replies_sender_id_fkey foreign KEY (sender_id) references auth.users (id) on delete CASCADE,
  constraint ticket_replies_ticket_id_fkey foreign KEY (ticket_id) references support_tickets (id) on delete CASCADE,
  constraint ticket_replies_sender_role_check check (
    (
      sender_role = any (array['user'::text, 'admin'::text])
    )
  )
) TABLESPACE pg_default;

create trigger on_ticket_reply
after INSERT on ticket_replies for EACH row
execute FUNCTION update_ticket_timestamp ();