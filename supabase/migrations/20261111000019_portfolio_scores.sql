-- Portfolio pictures on the rubric. The Work page's mix ("Show me work
-- that's quiet, playful…") used positions typed into the code, one per
-- project. Each picture now carries its own scores, from Claude with the
-- library's rubric, and the studio can correct any of them in Studio ›
-- Portfolio (lib/portfolio/scores.ts).
--
-- scores:      Claude's, by dimension key, -2…2 ({"density": 1, "tone": -0.5}).
-- score_edits: the studio's corrections, same shape; they win, and survive a rescore.
-- Videos aren't scored: they take the average of their project's pictures,
-- plus any corrections of their own.

alter table public.project_media
  add column if not exists scores jsonb not null default '{}'::jsonb,
  add column if not exists score_edits jsonb not null default '{}'::jsonb,
  add column if not exists scored_at timestamptz,
  add column if not exists score_error text;
