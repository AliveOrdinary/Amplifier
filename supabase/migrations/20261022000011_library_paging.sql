-- The library in pages: the studio screens ask for one page of images at a
-- time instead of loading the whole library, and counts and coverage are
-- worked out here. All functions run with the caller's rights (row level
-- security keeps studios apart).

-- Newest first, with the id to break ties: what a page of Browse walks.
create index if not exists images_studio_created_idx on public.images (studio_id, created_at desc, id desc);

-- An image is "ready" once resized and scored, or once scoring has failed.

-- One page of images, newest first. Every filter is optional; p_status 'all'
-- or null means any status. p_before / p_before_id continue after the last
-- image of the previous page.
create or replace function public.library_page(
  p_studio    uuid,
  p_status    text default null,
  p_medium    text default null,
  p_search    text default null,
  p_check     boolean default false,
  p_board     text default null,
  p_before    timestamptz default null,
  p_before_id uuid default null,
  p_limit     integer default 60
)
returns table (id uuid, created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select i.id, i.created_at
  from public.images i
  where i.studio_id = p_studio
    and i.display_path is not null
    and (i.scored_at is not null or i.score_error is not null)
    and (p_status is null or p_status = 'all' or i.status::text = p_status)
    and (p_medium is null or p_medium = '' or i.medium::text = p_medium)
    and (p_board is null or p_board = '' or i.collection = p_board)
    and (
      p_search is null or p_search = ''
      or position(lower(p_search) in lower(concat_ws(' ', i.description, i.original_name, i.collection))) > 0
    )
    and (
      not coalesce(p_check, false)
      or exists (select 1 from public.image_scores s where s.image_id = i.id and s.needs_check)
    )
    and (p_before is null or (i.created_at, i.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by i.created_at desc, i.id desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- The numbers on the library's tabs and filters.
create or replace function public.library_counts(p_studio uuid)
returns table (to_review integer, approved integer, scoring integer, to_check integer, newest timestamptz)
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
    count(*) filter (where i.display_path is null or (i.scored_at is null and i.score_error is null))::integer,
    count(*) filter (
      where i.display_path is not null
        and exists (select 1 from public.image_scores s where s.image_id = i.id and s.needs_check)
    )::integer,
    max(i.created_at)
  from public.images i
  where i.studio_id = p_studio;
$$;

-- Boards images were imported from ("Ana · Wayfinding"), with how many each.
create or replace function public.library_boards(p_studio uuid)
returns table (collection text, images integer)
language sql
stable
security invoker
set search_path = public
as $$
  select i.collection, count(*)::integer
  from public.images i
  where i.studio_id = p_studio
    and i.collection is not null
    and i.status <> 'rejected'
  group by i.collection
  order by i.collection;
$$;

-- Coverage: approved images per dimension and score bin (−2 … +2, rounded
-- half up, the same as the studio screens).
create or replace function public.library_coverage(p_studio uuid)
returns table (dimension text, bin integer, images integer)
language sql
stable
security invoker
set search_path = public
as $$
  select s.dimension, least(4, greatest(0, floor(s.score + 0.5)::integer + 2)), count(*)::integer
  from public.image_scores s
  join public.images i on i.id = s.image_id
  where i.studio_id = p_studio
    and i.status = 'approved'
  group by 1, 2;
$$;

-- Approved images per medium.
create or replace function public.library_media(p_studio uuid)
returns table (medium text, images integer)
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(i.medium::text, ''), count(*)::integer
  from public.images i
  where i.studio_id = p_studio
    and i.status = 'approved'
  group by 1;
$$;

-- Images for a picker (rubric anchors, brief pins, the moodboard): search,
-- optionally sorted by one dimension's score, a page at a time.
create or replace function public.library_pick(
  p_studio        uuid,
  p_search        text default null,
  p_dimension     text default null,
  p_ascending     boolean default true,
  p_approved_only boolean default false,
  p_offset        integer default 0,
  p_limit         integer default 60
)
returns table (id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  select i.id
  from public.images i
  left join public.image_scores s
    on s.image_id = i.id
   and s.dimension = p_dimension
  where i.studio_id = p_studio
    and i.display_path is not null
    and i.scored_at is not null
    and (case when p_approved_only then i.status = 'approved' else i.status <> 'rejected' end)
    and (
      p_search is null or p_search = ''
      or position(lower(p_search) in lower(concat_ws(' ', i.description, i.original_name, i.collection))) > 0
    )
  order by
    case when p_dimension is not null and p_ascending then coalesce(s.score, 0) end asc,
    case when p_dimension is not null and not p_ascending then coalesce(s.score, 0) end desc,
    i.created_at desc,
    i.id desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 200);
$$;

grant execute on function public.library_pick(uuid, text, text, boolean, boolean, integer, integer) to authenticated, service_role;
grant execute on function public.library_page(uuid, text, text, text, boolean, text, timestamptz, uuid, integer) to authenticated, service_role;
grant execute on function public.library_counts(uuid) to authenticated, service_role;
grant execute on function public.library_boards(uuid) to authenticated, service_role;
grant execute on function public.library_coverage(uuid) to authenticated, service_role;
grant execute on function public.library_media(uuid) to authenticated, service_role;
