-- One scoring run at a time per studio. Sending images to Claude and reading
-- results back used to start from every library refresh and every imported
-- pin; when a run was slow, dozens piled up and the studio slowed down. A run
-- now takes this lease first: anyone else who asks while it's held does
-- nothing, and a run cut off by its time limit lets go when the lease runs out.

create table if not exists public.score_runs (
  studio_id    uuid primary key references public.studios (id) on delete cascade,
  locked_until timestamptz not null default now(),
  holder       text
);

-- Only the server (service role) uses it; no policies, so members can't.
alter table public.score_runs enable row level security;

-- Take the lease if it's free (or has run out). True when this caller has it.
create or replace function public.take_score_run(p_studio uuid, p_holder text, p_seconds integer)
returns boolean
language sql
security definer
set search_path = public
as $$
  with taken as (
    insert into public.score_runs as r (studio_id, locked_until, holder)
    values (p_studio, now() + make_interval(secs => p_seconds), p_holder)
    on conflict (studio_id) do update
      set locked_until = excluded.locked_until, holder = excluded.holder
      where r.locked_until < now()
    returning 1
  )
  select exists (select 1 from taken);
$$;

-- Let go early, when the run finishes.
create or replace function public.end_score_run(p_studio uuid, p_holder text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.score_runs set locked_until = now() where studio_id = p_studio and holder = p_holder;
$$;

revoke all on function public.take_score_run(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.end_score_run(uuid, text) from public, anon, authenticated;
grant execute on function public.take_score_run(uuid, text, integer) to service_role;
grant execute on function public.end_score_run(uuid, text) to service_role;
