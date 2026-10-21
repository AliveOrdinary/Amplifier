-- Run once in the Supabase SQL editor after creating the three studio
-- accounts under Authentication > Users (with sign-ups turned off).
-- Replace the emails and names, then run.

insert into public.members (user_id, studio_id, display_name, role)
select u.id, s.id, m.display_name, m.role
from (values
  ('first@example.com',  'First Name',  'owner'),
  ('second@example.com', 'Second Name', 'member'),
  ('third@example.com',  'Third Name',  'member')
) as m (email, display_name, role)
join auth.users u on lower(u.email) = lower(m.email)
cross join public.studios s
where s.slug = 'amplifier'
on conflict (user_id) do update
  set display_name = excluded.display_name, role = excluded.role;

-- Check: should list all three.
select m.display_name, m.role, u.email
from public.members m join auth.users u on u.id = m.user_id;
