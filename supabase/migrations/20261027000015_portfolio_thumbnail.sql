-- A project's thumbnail: the image or video on its tile (Home's desk, the
-- Works page). Separate from the cover, which opens the case study. Empty
-- means the tile shows the cover.
alter table public.projects add column if not exists thumbnail_media_id uuid
  references public.project_media (id) on delete set null;
