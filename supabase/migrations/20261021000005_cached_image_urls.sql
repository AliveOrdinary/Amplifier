-- Keep each image's signed URLs for a week so the studio shows the same
-- address for an image between page loads, and the browser can cache it
-- instead of re-downloading every image whenever the page updates.

alter table public.images
  add column if not exists thumb_url      text,
  add column if not exists display_url    text,
  add column if not exists urls_expire_at timestamptz;
