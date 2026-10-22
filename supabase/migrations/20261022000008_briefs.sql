-- Phase 3: the client brief.

alter table public.briefs
  -- Frozen when the client first opens the link: the rubric, the warm-up
  -- images and the pool pairs are drawn from, with their scores at that
  -- moment. Later library changes don't move a brief that's under way.
  add column if not exists plan jsonb,
  -- A line from the studio on the welcome screen.
  add column if not exists note text;

alter table public.briefs alter column expires_at set default now() + interval '30 days';

-- Each pair keeps the two images' scores as they were when shown.
alter table public.reactions
  add column if not exists scores_a jsonb,
  add column if not exists scores_b jsonb;

-- Clients never touch these tables directly: their answers arrive through
-- the server, checked against the brief's private link.
