-- Amplifier v2 core schema.
-- Every studio-owned row carries a studio_id so the brief tool can serve
-- other studios later without a rewrite. Clients never touch these tables:
-- brief links are served by the app's server routes with the service key.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Studios and members
-- ---------------------------------------------------------------------------

create table public.studios (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

create table public.members (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  studio_id    uuid not null references public.studios (id) on delete cascade,
  display_name text,
  role         text not null default 'member' check (role in ('owner', 'member')),
  created_at   timestamptz not null default now()
);

-- The signed-in user's studio, or null for anyone who is not a member.
create or replace function public.current_studio_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select studio_id from public.members where user_id = auth.uid()
$$;

revoke all on function public.current_studio_id() from public;
grant execute on function public.current_studio_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Taste dimensions
-- ---------------------------------------------------------------------------

create table public.dimensions (
  key         text primary key,
  left_label  text not null,
  right_label text not null,
  sort        smallint not null unique
);

-- ---------------------------------------------------------------------------
-- Library
-- ---------------------------------------------------------------------------

create type public.medium as enum (
  'identity',
  'typography',
  'album_art',
  'poster_key_art',
  'motion_titles',
  'web',
  'packaging',
  'photography',
  'exhibition_spatial'
);

create type public.image_status as enum ('pending', 'approved', 'rejected');

create table public.images (
  id              uuid primary key default gen_random_uuid(),
  studio_id       uuid not null default public.current_studio_id()
                  references public.studios (id) on delete cascade,
  storage_path    text not null,
  mime_type       text,
  width           integer,
  height          integer,
  bytes           integer,
  file_hash       text,
  perceptual_hash text,
  source_url      text,
  page_url        text,
  medium          public.medium,
  description     text,
  status          public.image_status not null default 'pending',
  scored_at       timestamptz,
  scored_by       text,
  added_by        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (studio_id, file_hash)
);

create index images_studio_status_idx on public.images (studio_id, status);

create table public.image_scores (
  image_id   uuid not null references public.images (id) on delete cascade,
  dimension  text not null references public.dimensions (key) on update cascade,
  score      numeric(3, 1) not null check (score between -2 and 2),
  source     text not null default 'ai' check (source in ('ai', 'human')),
  confidence numeric(3, 2) check (confidence between 0 and 1),
  updated_at timestamptz not null default now(),
  primary key (image_id, dimension)
);

create index image_scores_dimension_idx on public.image_scores (dimension, score);

-- ---------------------------------------------------------------------------
-- Briefs
-- ---------------------------------------------------------------------------

create table public.question_templates (
  id           uuid primary key default gen_random_uuid(),
  studio_id    uuid not null default public.current_studio_id()
               references public.studios (id) on delete cascade,
  project_type text not null,
  name         text not null,
  questions    jsonb not null,
  sort         smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (studio_id, project_type)
);

create type public.brief_status as enum ('draft', 'sent', 'in_progress', 'completed', 'archived');

create table public.briefs (
  id           uuid primary key default gen_random_uuid(),
  studio_id    uuid not null default public.current_studio_id()
               references public.studios (id) on delete cascade,
  client_name  text not null,
  client_email text,
  project_name text,
  project_type text not null,
  medium       public.medium,
  questions    jsonb not null default '[]'::jsonb,
  -- 244 random bits; no extension needed
  token        text not null unique
               default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status       public.brief_status not null default 'draft',
  expires_at   timestamptz,
  meeting_at   timestamptz,
  sent_at      timestamptz,
  started_at   timestamptz,
  completed_at timestamptz,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index briefs_studio_status_idx on public.briefs (studio_id, status);

create table public.brief_pins (
  brief_id   uuid not null references public.briefs (id) on delete cascade,
  image_id   uuid not null references public.images (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brief_id, image_id)
);

create table public.answers (
  brief_id    uuid not null references public.briefs (id) on delete cascade,
  question_id text not null,
  value       jsonb not null,
  answered_at timestamptz not null default now(),
  primary key (brief_id, question_id)
);

create type public.reaction_kind as enum ('swipe', 'pair');

create table public.reactions (
  id               uuid primary key default gen_random_uuid(),
  brief_id         uuid not null references public.briefs (id) on delete cascade,
  seq              integer not null,
  kind             public.reaction_kind not null,
  image_a          uuid not null references public.images (id),
  image_b          uuid references public.images (id),
  target_dimension text references public.dimensions (key) on update cascade,
  is_probe         boolean not null default false,
  choice           text not null check (choice in ('keep', 'skip', 'a', 'b', 'both', 'neither')),
  caught           text[] not null default '{}',
  response_ms      integer check (response_ms >= 0),
  created_at       timestamptz not null default now(),
  unique (brief_id, seq),
  check ((kind = 'swipe' and image_b is null and choice in ('keep', 'skip'))
      or (kind = 'pair' and image_b is not null and choice in ('a', 'b', 'both', 'neither')))
);

create table public.reports (
  brief_id     uuid primary key references public.briefs (id) on delete cascade,
  said         jsonb not null default '{}'::jsonb,
  showed       jsonb not null default '{}'::jsonb,
  content      jsonb not null default '{}'::jsonb,
  model        text,
  generated_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Moodboards
-- ---------------------------------------------------------------------------

create table public.boards (
  id          uuid primary key default gen_random_uuid(),
  studio_id   uuid not null default public.current_studio_id()
              references public.studios (id) on delete cascade,
  brief_id    uuid unique references public.briefs (id) on delete set null,
  title       text not null,
  viewport    jsonb not null default '{"x":0,"y":0,"zoom":1}'::jsonb,
  share_token text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.board_items (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards (id) on delete cascade,
  parent_id  uuid references public.board_items (id) on delete set null,
  kind       text not null check (kind in ('image', 'note', 'group')),
  image_id   uuid references public.images (id) on delete cascade,
  body       text,
  x          real not null default 0,
  y          real not null default 0,
  w          real not null default 240,
  h          real not null default 240,
  z          integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'image' or image_id is not null)
);

create index board_items_board_idx on public.board_items (board_id);

-- ---------------------------------------------------------------------------
-- Portfolio
-- ---------------------------------------------------------------------------

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  studio_id     uuid not null default public.current_studio_id()
                references public.studios (id) on delete cascade,
  slug          text not null,
  title         text not null,
  client        text,
  year          smallint,
  services      text[] not null default '{}',
  short_summary text,
  body          text,
  cover_path    text,
  featured      boolean not null default false,
  published     boolean not null default false,
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (studio_id, slug)
);

create table public.project_media (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  kind         text not null check (kind in ('image', 'video')),
  storage_path text not null,
  caption      text,
  has_audio    boolean not null default false,
  sort         integer not null default 0,
  created_at   timestamptz not null default now()
);

create index project_media_project_idx on public.project_media (project_id, sort);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger images_updated_at before update on public.images
  for each row execute function public.set_updated_at();
create trigger image_scores_updated_at before update on public.image_scores
  for each row execute function public.set_updated_at();
create trigger question_templates_updated_at before update on public.question_templates
  for each row execute function public.set_updated_at();
create trigger briefs_updated_at before update on public.briefs
  for each row execute function public.set_updated_at();
create trigger reports_updated_at before update on public.reports
  for each row execute function public.set_updated_at();
create trigger boards_updated_at before update on public.boards
  for each row execute function public.set_updated_at();
create trigger board_items_updated_at before update on public.board_items
  for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- Members see and change only their own studio's rows. Anonymous visitors
-- see published portfolio projects and nothing else.
-- ---------------------------------------------------------------------------

alter table public.studios            enable row level security;
alter table public.members            enable row level security;
alter table public.dimensions         enable row level security;
alter table public.images             enable row level security;
alter table public.image_scores       enable row level security;
alter table public.question_templates enable row level security;
alter table public.briefs             enable row level security;
alter table public.brief_pins         enable row level security;
alter table public.answers            enable row level security;
alter table public.reactions          enable row level security;
alter table public.reports            enable row level security;
alter table public.boards             enable row level security;
alter table public.board_items        enable row level security;
alter table public.projects           enable row level security;
alter table public.project_media      enable row level security;

create policy "members read their studio" on public.studios
  for select to authenticated using (id = (select public.current_studio_id()));

create policy "members read their studio's members" on public.members
  for select to authenticated using (studio_id = (select public.current_studio_id()));

create policy "members read dimensions" on public.dimensions
  for select to authenticated using ((select public.current_studio_id()) is not null);

-- Studio-scoped tables
create policy "studio rows" on public.images
  for all to authenticated
  using (studio_id = (select public.current_studio_id()))
  with check (studio_id = (select public.current_studio_id()));

create policy "studio rows" on public.question_templates
  for all to authenticated
  using (studio_id = (select public.current_studio_id()))
  with check (studio_id = (select public.current_studio_id()));

create policy "studio rows" on public.briefs
  for all to authenticated
  using (studio_id = (select public.current_studio_id()))
  with check (studio_id = (select public.current_studio_id()));

create policy "studio rows" on public.boards
  for all to authenticated
  using (studio_id = (select public.current_studio_id()))
  with check (studio_id = (select public.current_studio_id()));

create policy "studio rows" on public.projects
  for all to authenticated
  using (studio_id = (select public.current_studio_id()))
  with check (studio_id = (select public.current_studio_id()));

-- Child tables follow their parent
create policy "via image" on public.image_scores
  for all to authenticated
  using (exists (select 1 from public.images i
                 where i.id = image_id and i.studio_id = (select public.current_studio_id())))
  with check (exists (select 1 from public.images i
                      where i.id = image_id and i.studio_id = (select public.current_studio_id())));

create policy "via brief" on public.brief_pins
  for all to authenticated
  using (exists (select 1 from public.briefs b
                 where b.id = brief_id and b.studio_id = (select public.current_studio_id())))
  with check (exists (select 1 from public.briefs b
                      where b.id = brief_id and b.studio_id = (select public.current_studio_id())));

create policy "via brief" on public.answers
  for select to authenticated
  using (exists (select 1 from public.briefs b
                 where b.id = brief_id and b.studio_id = (select public.current_studio_id())));

create policy "via brief" on public.reactions
  for select to authenticated
  using (exists (select 1 from public.briefs b
                 where b.id = brief_id and b.studio_id = (select public.current_studio_id())));

create policy "via brief" on public.reports
  for all to authenticated
  using (exists (select 1 from public.briefs b
                 where b.id = brief_id and b.studio_id = (select public.current_studio_id())))
  with check (exists (select 1 from public.briefs b
                      where b.id = brief_id and b.studio_id = (select public.current_studio_id())));

create policy "via board" on public.board_items
  for all to authenticated
  using (exists (select 1 from public.boards b
                 where b.id = board_id and b.studio_id = (select public.current_studio_id())))
  with check (exists (select 1 from public.boards b
                      where b.id = board_id and b.studio_id = (select public.current_studio_id())));

create policy "via project" on public.project_media
  for all to authenticated
  using (exists (select 1 from public.projects p
                 where p.id = project_id and p.studio_id = (select public.current_studio_id())))
  with check (exists (select 1 from public.projects p
                      where p.id = project_id and p.studio_id = (select public.current_studio_id())));

-- Public portfolio
create policy "anyone reads published projects" on public.projects
  for select to anon using (published);

create policy "anyone reads media of published projects" on public.project_media
  for select to anon
  using (exists (select 1 from public.projects p where p.id = project_id and p.published));

-- ---------------------------------------------------------------------------
-- Storage
-- library: private, members only, files under <studio_id>/...
-- portfolio: public read, members write
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('library', 'library', false), ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

create policy "members manage library files" on storage.objects
  for all to authenticated
  using (bucket_id = 'library'
         and (storage.foldername(name))[1] = (select public.current_studio_id())::text)
  with check (bucket_id = 'library'
              and (storage.foldername(name))[1] = (select public.current_studio_id())::text);

create policy "members manage portfolio files" on storage.objects
  for all to authenticated
  using (bucket_id = 'portfolio'
         and (storage.foldername(name))[1] = (select public.current_studio_id())::text)
  with check (bucket_id = 'portfolio'
              and (storage.foldername(name))[1] = (select public.current_studio_id())::text);
