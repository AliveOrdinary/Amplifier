-- What the AI services cost, as the studio uses them, and a monthly amount
-- that shows an alert once passed. Plus what the Members page needs.

-- One row per API call (or per finished batch): tokens as the API reported
-- them, and the estimated cost in US dollars at list prices when recorded.
create table if not exists public.api_usage (
  id                 bigint generated always as identity primary key,
  studio_id          uuid not null references public.studios (id) on delete cascade,
  at                 timestamptz not null default now(),
  -- score, score_batch, report, embed_image, embed_text
  kind               text not null,
  model              text not null,
  -- images scored or embedded in this call
  images             integer not null default 0,
  input_tokens       bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  cache_read_tokens  bigint not null default 0,
  output_tokens      bigint not null default 0,
  pixels             bigint not null default 0,
  cost_usd           numeric(12, 6) not null default 0
);

create index if not exists api_usage_studio_at_idx on public.api_usage (studio_id, at);

alter table public.api_usage enable row level security;

drop policy if exists "studio rows" on public.api_usage;
create policy "studio rows" on public.api_usage
  for all to authenticated
  using (studio_id = public.current_studio_id())
  with check (studio_id = public.current_studio_id());

-- Show an alert across the studio once the month's estimate passes this. Null: off.
alter table public.studios add column if not exists monthly_alert_usd numeric(10, 2);

-- Spending between two moments, by kind.
create or replace function public.usage_summary(p_studio uuid, p_from timestamptz, p_to timestamptz)
returns table (kind text, calls integer, images integer, cost_usd numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select u.kind, count(*)::integer, coalesce(sum(u.images), 0)::integer, coalesce(sum(u.cost_usd), 0)
  from public.api_usage u
  where u.studio_id = p_studio
    and u.at >= p_from
    and u.at < p_to
  group by u.kind;
$$;

grant execute on function public.usage_summary(uuid, timestamptz, timestamptz) to authenticated, service_role;
