-- French for the public site. Each project keeps its French beside the
-- English, in one object; anything missing falls back to the English.
--
-- {
--   "title":    "Crums",
--   "summary":  "…",
--   "services": ["Nom", "Identité", …],
--   "blocks":   { "<block id>": { "text": "Markdown" } | { "caption": "…" } },
--   "alt":      { "<project_media id>": "What the image shows" }
-- }

alter table public.projects add column if not exists fr jsonb not null default '{}'::jsonb;

alter table public.projects drop constraint if exists projects_fr_is_object;
alter table public.projects add constraint projects_fr_is_object check (jsonb_typeof(fr) = 'object');
