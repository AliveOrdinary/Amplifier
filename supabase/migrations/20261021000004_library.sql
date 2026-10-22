-- Phase 2: library processing and the browser extension's personal keys.

alter table public.images
  add column if not exists original_name text,
  add column if not exists display_path  text,  -- webp, long edge <= 1600px
  add column if not exists thumb_path    text,  -- webp, long edge <= 480px
  add column if not exists score_error   text;

-- Personal keys for the browser extension. Only a SHA-256 hash is stored;
-- the key itself is shown once when created.
create table public.member_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  studio_id    uuid not null default public.current_studio_id()
               references public.studios (id) on delete cascade,
  label        text not null default 'Browser extension',
  key_hash     text not null unique,
  key_prefix   text not null,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.member_keys enable row level security;

create policy "members manage their own keys" on public.member_keys
  for all to authenticated
  using (user_id = (select auth.uid()) and studio_id = (select public.current_studio_id()))
  with check (user_id = (select auth.uid()) and studio_id = (select public.current_studio_id()));
