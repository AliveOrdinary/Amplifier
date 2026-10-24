-- The portfolio engine: projects written as a list of blocks (text, or one
-- to three images and videos side by side), media that knows its size, a
-- cover, and when a project went public.

-- ---------------------------------------------------------------- projects

-- Case studies are blocks now; the single body field and the cover file path
-- were never used.
alter table public.projects drop column if exists body;
alter table public.projects drop column if exists cover_path;

-- [{ "id": "…", "type": "text", "text": "Markdown" },
--  { "id": "…", "type": "media", "media": ["<project_media id>", …], "caption": "…" }]
alter table public.projects add column if not exists blocks jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists published_at timestamptz;

alter table public.projects drop constraint if exists projects_blocks_is_array;
alter table public.projects add constraint projects_blocks_is_array check (jsonb_typeof(blocks) = 'array');

-- Lowercase words joined by hyphens: the address on the site (/projects/crums).
alter table public.projects drop constraint if exists projects_slug_format;
alter table public.projects add constraint projects_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- ------------------------------------------------------------------- media

alter table public.project_media add column if not exists width  integer;
alter table public.project_media add column if not exists height integer;
-- What the image shows, for screen readers.
alter table public.project_media add column if not exists alt    text;
alter table public.project_media add column if not exists bytes  bigint;
alter table public.project_media add column if not exists mime   text;

-- The image or video shown for the project in lists (a video plays muted).
alter table public.projects add column if not exists cover_media_id uuid
  references public.project_media (id) on delete set null;

-- Keep published_at in step with published: set the first time it goes
-- public, kept while it stays public, cleared when it's taken down.
create or replace function public.set_published_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.published and new.published_at is null then
    new.published_at := now();
  elsif not new.published then
    new.published_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_published_at on public.projects;
create trigger projects_published_at before insert or update of published on public.projects
  for each row execute function public.set_published_at();

create index if not exists projects_public_idx on public.projects (published, sort);
