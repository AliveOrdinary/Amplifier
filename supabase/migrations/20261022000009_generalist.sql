-- A generalist studio: more media and project types, Pinterest board imports,
-- scoring queued through the Batch API, and rescoring one dimension at a time.

-- ---------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------

alter type public.medium add value if not exists 'signage_wayfinding';
alter type public.medium add value if not exists 'interiors';
alter type public.medium add value if not exists 'print_editorial';
alter type public.medium add value if not exists 'illustration';

-- ---------------------------------------------------------------------------
-- Project types: retired ones stay so older briefs keep their label.
-- ---------------------------------------------------------------------------

alter table public.question_templates add column if not exists retired_at timestamptz;

update public.question_templates
set retired_at = coalesce(retired_at, now())
where project_type in ('musician_identity', 'album_artwork', 'film_key_art', 'exhibition');

update public.question_templates set name = 'Brand identity (new)', sort = 1 where project_type = 'brand_identity';
update public.question_templates set sort = 3 where project_type = 'website';
update public.question_templates set name = 'Event', sort = 8 where project_type = 'event_festival';

-- "What should the night feel like?" assumed an evening gig.
update public.question_templates
set questions = (
  select jsonb_agg(
    case when q->>'id' = 'night_feel'
      then jsonb_set(q, '{prompt}', '"What should it feel like to be there?"')
      else q end
    order by n)
  from jsonb_array_elements(questions) with ordinality as e (q, n)
)
where project_type = 'event_festival';

with core as (
  select
    '[
      {"id":"making","prompt":"What are you making, and who is it for?","help":"One or two sentences.","format":"long"},
      {"id":"three_words","prompt":"Three words for how it should feel.","format":"three_words"},
      {"id":"never","prompt":"What should it never feel like?","format":"short"},
      {"id":"admire","prompt":"A brand or piece of work you admire, from any field.","help":"A name or a link. Why is optional.","format":"link"}
    ]'::jsonb as head,
    '[
      {"id":"decided","prompt":"Anything already decided?","help":"Colours, must-keep elements, deadlines, constraints.","format":"long","optional":true}
    ]'::jsonb as tail
),
templates (project_type, name, addons, sort) as (
  values
  ('rebrand', 'Rebrand or refresh', '[
    {"id":"keep","prompt":"What should survive the change?","help":"A colour, a symbol, a name, a feeling.","format":"short"},
    {"id":"why_now","prompt":"Why change now?","format":"short"}
  ]'::jsonb, 2),
  ('packaging_product', 'Packaging or product', '[
    {"id":"first_seen","prompt":"Where will people first see it?","format":"chips","options":["Shop shelf","Online","Market or fair","As a gift","Subscription"]},
    {"id":"neighbours","prompt":"What will it sit next to, and how should it differ?","format":"short"}
  ]'::jsonb, 4),
  ('space_signage', 'Space, signage and wayfinding', '[
    {"id":"place","prompt":"What kind of place is it?","help":"A clinic, a shop, a studio, a pod…","format":"short"},
    {"id":"walk_in","prompt":"Who walks through the door?","format":"short"},
    {"id":"first_ten","prompt":"How should someone feel in the first ten seconds?","format":"short"}
  ]'::jsonb, 5),
  ('campaign_print', 'Campaign, poster or print', '[
    {"id":"where_seen","prompt":"Where will people see it?","format":"chips","options":["Street","Social","Print","Email","At an event","In store"]},
    {"id":"remember","prompt":"The one thing someone should remember.","format":"short"}
  ]'::jsonb, 6),
  ('creative_release', 'Music, film or art release', '[
    {"id":"describe_work","prompt":"Describe the work to someone who hasn''t heard or seen it.","help":"One or two sentences.","format":"long"},
    {"id":"kindred","prompt":"Two or three artists whose world feels close to yours.","format":"short"}
  ]'::jsonb, 7)
)
insert into public.question_templates (studio_id, project_type, name, questions, sort)
select s.id, t.project_type, t.name, core.head || t.addons || core.tail, t.sort
from public.studios s, core, templates t
on conflict (studio_id, project_type) do nothing;

-- ---------------------------------------------------------------------------
-- Library: where an image came from, and why it waits for review
-- ---------------------------------------------------------------------------

alter table public.images
  -- "Ana · Wayfinding": who imported it and from which board
  add column if not exists collection    text,
  -- Set when an imported image needs a person to look at it
  add column if not exists review_reason text;

-- When Claude last scored each dimension of an image. A dimension changed
-- after that is out of date for that image, and only it is rescored.
alter table public.image_scores add column if not exists ai_scored_at timestamptz;

update public.image_scores s
set ai_scored_at = i.scored_at
from public.images i
where i.id = s.image_id
  and s.ai_scored_at is null
  and (s.source = 'ai' or s.ai_score is not null);

-- ---------------------------------------------------------------------------
-- Scoring queue: images waiting to be scored through the Batch API
-- ---------------------------------------------------------------------------

create table if not exists public.score_queue (
  image_id     uuid primary key references public.images (id) on delete cascade,
  studio_id    uuid not null references public.studios (id) on delete cascade,
  -- null: every dimension, plus description and medium
  dimensions   text[],
  -- Board imports go straight to the library unless something needs a look
  auto_approve boolean not null default false,
  queued_at    timestamptz not null default now(),
  -- The dimensions actually asked for once sent, to read the answer back
  asked        text[],
  batch_id     text,
  submitted_at timestamptz
);

create index if not exists score_queue_waiting_idx
  on public.score_queue (studio_id, queued_at) where batch_id is null;
create index if not exists score_queue_batch_idx on public.score_queue (batch_id);

create table if not exists public.score_batches (
  id            text primary key,
  studio_id     uuid not null references public.studios (id) on delete cascade,
  request_count integer not null,
  created_at    timestamptz not null default now(),
  checked_at    timestamptz,
  ended_at      timestamptz,
  succeeded     integer,
  failed        integer
);

alter table public.score_queue enable row level security;
alter table public.score_batches enable row level security;

drop policy if exists "studio rows" on public.score_queue;
create policy "studio rows" on public.score_queue
  for all to authenticated
  using (studio_id = public.current_studio_id())
  with check (studio_id = public.current_studio_id());

drop policy if exists "studio rows" on public.score_batches;
create policy "studio rows" on public.score_batches
  for all to authenticated
  using (studio_id = public.current_studio_id())
  with check (studio_id = public.current_studio_id());

-- ---------------------------------------------------------------------------
-- Out-of-date scores, per image and dimension
-- ---------------------------------------------------------------------------

-- Images with at least one dimension changed since Claude last scored it,
-- and which dimensions those are. Images already queued are left out.
create or replace function public.stale_scores(p_studio uuid, p_limit integer default 100)
returns table (image_id uuid, dimensions text[])
language sql
stable
security invoker
set search_path = public
as $$
  select i.id, array_agg(d.key order by d.sort)
  from public.images i
  join public.dimensions d
    on d.studio_id = i.studio_id
   and d.retired_at is null
  left join public.image_scores s
    on s.image_id = i.id
   and s.dimension = d.key
  where i.studio_id = p_studio
    and i.status <> 'rejected'
    and i.scored_at is not null
    and not exists (select 1 from public.score_queue q where q.image_id = i.id)
    and (s.ai_scored_at is null or s.ai_scored_at < d.revised_at)
  group by i.id
  order by i.id
  limit greatest(p_limit, 1);
$$;

create or replace function public.stale_score_count(p_studio uuid)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(distinct i.id)::integer
  from public.images i
  join public.dimensions d
    on d.studio_id = i.studio_id
   and d.retired_at is null
  left join public.image_scores s
    on s.image_id = i.id
   and s.dimension = d.key
  where i.studio_id = p_studio
    and i.status <> 'rejected'
    and i.scored_at is not null
    and not exists (select 1 from public.score_queue q where q.image_id = i.id)
    and (s.ai_scored_at is null or s.ai_scored_at < d.revised_at);
$$;

grant execute on function public.stale_scores(uuid, integer) to authenticated, service_role;
grant execute on function public.stale_score_count(uuid) to authenticated, service_role;
