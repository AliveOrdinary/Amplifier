-- Remove the v1 tagger and briefing tables, their data and helper functions.
-- The studio confirmed none of the v1 data is needed.
--
-- Storage files are not touched here (Supabase only allows deleting them
-- through the Storage API): empty and delete the old `reference-images`
-- bucket from the dashboard under Storage.

drop table if exists public.tag_corrections   cascade;
drop table if exists public.reference_images  cascade;
drop table if exists public.tag_vocabulary    cascade;
drop table if exists public.vocabulary_config cascade;
drop table if exists public.user_settings     cascade;

drop function if exists public.increment_tag_usage(text, text, timestamptz);
drop function if exists public.decrement_tag_usage(text, text);
drop function if exists public.sync_reference_images_schema(text, text);
drop function if exists public.get_setting(text);
drop function if exists public.update_setting(text, text);
drop function if exists public.get_table_columns(text);

-- Old storage policies on the v1 bucket
drop policy if exists "Authenticated users can upload images" on storage.objects;
