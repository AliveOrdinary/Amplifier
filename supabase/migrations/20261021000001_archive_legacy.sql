-- Archive the v1 tagger and briefing tables.
-- Nothing is deleted: the old tables move into a `legacy` schema that the
-- app's API roles can no longer reach. Drop the schema later once you are
-- sure nothing in it is needed.

create schema if not exists legacy;

alter table if exists public.reference_images  set schema legacy;
alter table if exists public.tag_vocabulary    set schema legacy;
alter table if exists public.tag_corrections   set schema legacy;
alter table if exists public.vocabulary_config set schema legacy;
alter table if exists public.user_settings     set schema legacy;

revoke all on schema legacy from anon, authenticated;

-- v1 helper functions that only operated on the archived tables.
drop function if exists public.increment_tag_usage(text, text, timestamptz);
drop function if exists public.decrement_tag_usage(text, text);
drop function if exists public.sync_reference_images_schema(text, text);
drop function if exists public.get_setting(text);
drop function if exists public.update_setting(text, text);
drop function if exists public.get_table_columns(text);
