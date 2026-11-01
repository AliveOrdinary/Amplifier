-- Briefs started by visitors from the public site ("Start a brief"), next to
-- the ones the studio makes and sends.

-- Who started it: the studio (Studio › Briefs › New brief) or a visitor on the site.
alter table public.briefs add column if not exists source text not null default 'studio';
alter table public.briefs drop constraint if exists briefs_source_check;
alter table public.briefs add constraint briefs_source_check check (source in ('studio', 'site'));

-- When a studio member first opened a brief from the site (the Briefs tab counts the unopened ones).
alter table public.briefs add column if not exists seen_at timestamptz;

-- A one-way hash of the visitor's network address, for the daily limit. Not the address itself.
alter table public.briefs add column if not exists requester_hash text;

create index if not exists briefs_site_recent_idx on public.briefs (source, created_at desc);
create index if not exists briefs_requester_idx on public.briefs (requester_hash, created_at desc) where requester_hash is not null;
