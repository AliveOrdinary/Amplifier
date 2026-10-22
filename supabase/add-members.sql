-- Run once in the Supabase SQL editor after creating your account under
-- Authentication > Users (with sign-ups turned off). Replace the email and
-- name, then run. You become the studio owner; other members will be
-- invited from the studio's Settings page.

insert into public.members (user_id, studio_id, display_name, role)
select u.id, s.id, 'Your Name', 'owner'
from auth.users u
cross join public.studios s
where lower(u.email) = lower('you@example.com')
  and s.slug = 'amplifier'
on conflict (user_id) do update
  set display_name = excluded.display_name, role = excluded.role;

-- Check: should list your account as owner.
select m.display_name, m.role, u.email
from public.members m join auth.users u on u.id = m.user_id;
