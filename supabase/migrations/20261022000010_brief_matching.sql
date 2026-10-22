-- Brief matching: the approved images closest to a piece of text (the
-- client's "What are you making?" answer, embedded with Voyage), closest
-- first. The brief draws most of its images from these.
--
-- This is an exact search over the studio's images rather than the HNSW
-- index: the index stops after its first 40 candidates by default, and the
-- setting that raises that can't be changed on Supabase. Exact is still quick
-- for a studio library (milliseconds at tens of thousands of images). The
-- "+ 0" keeps the planner from using the index.

create or replace function public.images_near(p_studio uuid, p_query extensions.vector(1024), p_limit integer default 400)
returns table (id uuid, medium public.medium, distance double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select i.id, i.medium, (i.embedding <=> p_query)::double precision as distance
  from public.images i
  where i.studio_id = p_studio
    and i.status = 'approved'
    and i.scored_at is not null
    and i.embedding is not null
  order by (i.embedding <=> p_query) + 0
  limit least(greatest(p_limit, 1), 1000);
$$;

grant execute on function public.images_near(uuid, extensions.vector, integer) to authenticated, service_role;
