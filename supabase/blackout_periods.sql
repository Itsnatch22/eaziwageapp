create table public.blackout_periods (
  id uuid not null default gen_random_uuid (),
  name text not null,
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  applies_to text not null default 'all'::text,
  reason text null,
  is_active numeric not null default '1'::numeric,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint blackout_periods_pkey primary key (id),
  constraint blackout_periods_dates_check check ((end_date >= start_date)),
  constraint blackout_periods_is_active_check check (
    (
      is_active = any (array[(0)::numeric, (1)::numeric])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_blackout_periods_applies_to on public.blackout_periods using btree (applies_to) TABLESPACE pg_default;

create index IF not exists idx_blackout_periods_dates on public.blackout_periods using btree (start_date, end_date) TABLESPACE pg_default;

create index IF not exists idx_blackout_periods_is_active on public.blackout_periods using btree (is_active) TABLESPACE pg_default
where
  (is_active = (1)::numeric);

create trigger blackout_periods_updated_at BEFORE
update on blackout_periods for EACH row
execute FUNCTION update_updated_at ();