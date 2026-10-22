-- The studio's own rubric: editable dimensions with written definitions,
-- anchor images that show each end, and corrections Claude learns from.

-- Dimensions belong to a studio and can be edited, added and retired.
alter table public.dimensions
  add column if not exists studio_id        uuid references public.studios (id) on delete cascade,
  add column if not exists left_definition  text not null default '',
  add column if not exists right_definition text not null default '',
  add column if not exists retired_at       timestamptz,
  -- When the meaning last changed. Images scored before this are rescored.
  add column if not exists revised_at       timestamptz not null default now(),
  add column if not exists created_at       timestamptz not null default now();

update public.dimensions
set studio_id = (select id from public.studios where slug = 'amplifier')
where studio_id is null;

alter table public.dimensions alter column studio_id set default public.current_studio_id();
alter table public.dimensions alter column studio_id set not null;
alter table public.dimensions drop constraint if exists dimensions_sort_key;

-- The eight starting dimensions keep their current scores: their
-- definitions below are the ones Claude has been scoring with.
update public.dimensions d
set left_definition  = v.left_definition,
    right_definition = v.right_definition,
    revised_at       = '2000-01-01'
from (values
  ('density',     'Few elements, generous empty space.',
                  'Many elements, layered, dense, busy.'),
  ('volume',      'Muted colour, low contrast, restrained, small type.',
                  'High contrast, saturated colour, large type, grabs attention.'),
  ('temperature', 'Reds, oranges, yellows, earth tones, warm light.',
                  'Blues, greens, cold greys, cold light. Black and white or balanced palettes sit in the middle.'),
  ('era',         'Historical references, traditional craft, period styles such as art nouveau, Swiss modernism or the 70s.',
                  'Current, of the moment.'),
  ('form',        'Curves, hand-drawn lines, natural and irregular shapes.',
                  'Grids, straight lines, precise construction.'),
  ('tone',        'Sober, formal, grave.',
                  'Humorous, light, whimsical.'),
  ('finish',      'Handmade, textured, imperfect, analogue, print artefacts.',
                  'Slick, digital, glossy, highly refined.'),
  ('abstraction', 'Photographic or figurative, a recognisable subject.',
                  'Non-representational shapes, pattern or type alone.')
) as v (key, left_definition, right_definition)
where d.key = v.key and d.left_definition = '';

drop policy if exists "members read dimensions" on public.dimensions;
drop policy if exists "studio rows" on public.dimensions;
create policy "studio rows" on public.dimensions
  for all to authenticated
  using (studio_id = (select public.current_studio_id()))
  with check (studio_id = (select public.current_studio_id()));

-- Claude's own score is kept when someone corrects it, so corrections can be
-- shown back to Claude as examples. needs_check marks a correction made
-- before the dimension's definition last changed.
alter table public.image_scores
  add column if not exists ai_score    numeric(3, 1) check (ai_score between -2 and 2),
  add column if not exists needs_check boolean not null default false;

update public.image_scores set ai_score = score where source = 'ai' and ai_score is null;

-- Images that show what each end of a dimension means.
create table if not exists public.dimension_anchors (
  dimension  text not null references public.dimensions (key) on update cascade on delete cascade,
  image_id   uuid not null references public.images (id) on delete cascade,
  side       text not null check (side in ('left', 'right')),
  created_at timestamptz not null default now(),
  primary key (dimension, image_id)
);

alter table public.dimension_anchors enable row level security;

drop policy if exists "via dimension" on public.dimension_anchors;
create policy "via dimension" on public.dimension_anchors
  for all to authenticated
  using (exists (select 1 from public.dimensions d
                 where d.key = dimension and d.studio_id = (select public.current_studio_id())))
  with check (exists (select 1 from public.dimensions d
                      where d.key = dimension and d.studio_id = (select public.current_studio_id())));
