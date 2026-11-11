-- Images that never finished being added. Adding an image has two steps:
-- store the original, then make its display and thumbnail versions. When the
-- second step was cut off (a timeout, the database struggling), the image sat
-- with no display version forever, counted as "scoring". The library now
-- retries these (lib/library/unfinished.ts) and, after a few tries, shows them
-- on the Review screen to retry or remove.

alter table public.images
  add column if not exists add_attempts smallint not null default 0,
  add column if not exists add_tried_at timestamptz,
  add column if not exists add_error text;

-- `scoring` no longer counts images that gave up; `stuck` counts those, and
-- `unfinished` the ones due a retry (no display version, quiet for 15 minutes).
drop function if exists public.library_counts(uuid);
create function public.library_counts(p_studio uuid)
returns table (
  to_review integer,
  approved integer,
  scoring integer,
  to_check integer,
  newest timestamptz,
  stuck integer,
  unfinished integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*) filter (
      where i.status = 'pending' and i.display_path is not null and (i.scored_at is not null or i.score_error is not null)
    )::integer,
    count(*) filter (where i.status = 'approved')::integer,
    count(*) filter (
      where i.add_error is null and (i.display_path is null or (i.scored_at is null and i.score_error is null))
    )::integer,
    count(*) filter (
      where i.display_path is not null
        and exists (select 1 from public.image_scores s where s.image_id = i.id and s.needs_check)
    )::integer,
    max(i.created_at),
    count(*) filter (where i.display_path is null and i.add_error is not null)::integer,
    count(*) filter (
      where i.display_path is null and i.add_error is null
        and i.created_at < now() - interval '15 minutes'
        and (i.add_tried_at is null or i.add_tried_at < now() - interval '5 minutes')
    )::integer
  from public.images i
  where i.studio_id = p_studio;
$$;
grant execute on function public.library_counts(uuid) to authenticated, service_role;
