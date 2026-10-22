-- Seed: the Amplifier studio, the eight taste dimensions, and the default
-- question templates (5 core questions + 1–3 add-ons per project type).
--
-- Question shape: { id, prompt, help?, format, options?, optional? }
--   format: long | short | three_words | chips | link

-- Only on a fresh database: afterwards the rubric is edited in Settings.
insert into public.dimensions (key, left_label, right_label, sort)
select * from (values
  ('density',     'Minimal', 'Rich',         1),
  ('volume',      'Quiet',   'Loud',         2),
  ('temperature', 'Warm',    'Cool',         3),
  ('era',         'Classic', 'Contemporary', 4),
  ('form',        'Organic', 'Geometric',    5),
  ('tone',        'Serious', 'Playful',      6),
  ('finish',      'Crafted', 'Polished',     7),
  ('abstraction', 'Literal', 'Abstract',     8)
) as v (key, left_label, right_label, sort)
where not exists (select 1 from public.dimensions);

with studio as (
  insert into public.studios (name, slug)
  values ('Amplifier', 'amplifier')
  on conflict (slug) do update set name = excluded.name
  returning id
),
core as (
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
  ('musician_identity', 'Musician or artist identity', '[
    {"id":"describe_work","prompt":"Describe your work to someone who has never heard or seen it.","help":"One or two sentences.","format":"long"},
    {"id":"kindred","prompt":"Two or three artists whose world, not just their work, feels close to yours.","format":"short"},
    {"id":"dinner_party","prompt":"If it were a person at a dinner party, how would they behave?","format":"short","optional":true}
  ]'::jsonb, 1),
  ('album_artwork', 'Album, single or EP artwork', '[
    {"id":"record_about","prompt":"What is the record about?","format":"long"},
    {"id":"before_play","prompt":"What should someone feel before they press play?","format":"short"}
  ]'::jsonb, 2),
  ('film_key_art', 'Film or series: poster, titles, key art', '[
    {"id":"genre","prompt":"Genre","format":"chips","options":["Drama","Comedy","Thriller","Horror","Documentary","Sci-fi","Romance","Animation","Experimental"]},
    {"id":"film_tone","prompt":"In one line, what is the tone?","format":"short"},
    {"id":"poster_love","prompt":"A film whose poster or titles you love.","format":"link"}
  ]'::jsonb, 3),
  ('event_festival', 'Event or festival', '[
    {"id":"who_comes","prompt":"Who comes?","format":"short"},
    {"id":"night_feel","prompt":"What should the night feel like?","format":"short"}
  ]'::jsonb, 4),
  ('exhibition', 'Exhibition or gallery', '[
    {"id":"takeaway","prompt":"What should a visitor take away?","format":"short"},
    {"id":"design_volume","prompt":"How loud should the design be next to the work?","format":"short"}
  ]'::jsonb, 5),
  ('brand_identity', 'Brand identity', '[
    {"id":"touchpoints","prompt":"Where will people meet the brand most?","format":"chips","options":["Packaging","Signage","Social","Web","Print","Merch"]},
    {"id":"dinner_party","prompt":"If it were a person at a dinner party, how would they behave?","format":"short","optional":true}
  ]'::jsonb, 6),
  ('website', 'Website', '[
    {"id":"first_visit","prompt":"What should a first-time visitor do or understand first?","format":"short"},
    {"id":"site_enjoy","prompt":"A site you enjoy using, and why?","format":"link"}
  ]'::jsonb, 7)
)
insert into public.question_templates (studio_id, project_type, name, questions, sort)
select studio.id, t.project_type, t.name, core.head || t.addons || core.tail, t.sort
from studio, core, templates t
on conflict (studio_id, project_type) do nothing;
