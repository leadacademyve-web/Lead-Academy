create table if not exists public.entitlements (
  user_email text not null,
  plan text not null,
  level text not null default 'LIVE',
  status text not null default 'inactive',
  provider text,
  last_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_email, plan, level)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists entitlements_set_updated_at on public.entitlements;
create trigger entitlements_set_updated_at
before update on public.entitlements
for each row
execute function public.set_updated_at();
