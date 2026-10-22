-- Brief matching: the approved images closest to a piece of text (the
-- client's "What are you making?" answer, embedded with Voyage), closest
-- first. The brief draws most of its images from these.

create or replace function public.images_near(p_studio uuid, p_query extensions.vector(1024), p_limit integer default 400)
returns table (id uuid, medium public.medium, distance double precision)
language sql
stable
security invoker
set search_path = public, extensions
-- The index search looks at this many candidates; the default (40) would cut the list short.
set hnsw.ef_search = 1000
as $$
  select i.id, i.medium, (i.embedding <=> p_query)::double precision
  from public.images i
  where i.studio_id = p_studio
    and i.status = 'approved'
    and i.scored_at is not null
    and i.embedding is not null
  order by i.embedding <=> p_query
  limit least(greatest(p_limit, 1), 1000);
$$;

grant execute on function public.images_near(uuid, extensions.vector, integer) to authenticated, service_role;
