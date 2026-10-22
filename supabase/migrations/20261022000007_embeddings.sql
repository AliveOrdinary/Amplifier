-- Image embeddings (Voyage multimodal, 1024 numbers per image): finding
-- similar images, near-duplicates, and pairs for briefs.

create extension if not exists vector with schema extensions;

alter table public.images
  add column if not exists embedding   extensions.vector(1024),
  add column if not exists embedded_at timestamptz,
  add column if not exists embed_error text;

create index if not exists images_embedding_idx
  on public.images using hnsw (embedding extensions.vector_cosine_ops);

-- The images most like one image, closest first (cosine distance: 0 is
-- identical). Runs with the caller's rights, so studios stay separate.
create or replace function public.similar_images(p_image uuid, p_limit integer default 24)
returns table (id uuid, distance double precision)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select i.id, (i.embedding <=> src.embedding)::double precision as distance
  from public.images src
  join public.images i
    on i.studio_id = src.studio_id
   and i.id <> src.id
   and i.embedding is not null
   and i.status <> 'rejected'
  where src.id = p_image
    and src.embedding is not null
  order by i.embedding <=> src.embedding
  limit least(greatest(p_limit, 1), 100);
$$;

grant execute on function public.similar_images(uuid, integer) to authenticated, service_role;
