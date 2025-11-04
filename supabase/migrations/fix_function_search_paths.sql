-- Fix function search_path issues for security
-- Adds explicit search_path to prevent search_path injection attacks
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- 1. Fix increment_tag_usage function
CREATE OR REPLACE FUNCTION public.increment_tag_usage(
  p_category text,
  p_tag_value text,
  p_last_used_at timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE tag_vocabulary
  SET
    times_used = times_used + 1,
    last_used_at = p_last_used_at
  WHERE
    category = p_category
    AND tag_value = p_tag_value;
END;
$function$;

-- 2. Fix decrement_tag_usage function
CREATE OR REPLACE FUNCTION public.decrement_tag_usage(
  p_category text,
  p_tag_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE tag_vocabulary
  SET times_used = GREATEST(times_used - 1, 0)
  WHERE
    category = p_category
    AND tag_value = p_tag_value;
END;
$function$;

-- 3. Fix sync_reference_images_schema function (already has SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.sync_reference_images_schema(
  column_name text,
  column_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result JSONB;
  column_exists BOOLEAN;
BEGIN
  -- Check if column already exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'reference_images'
      AND table_schema = 'public'
      AND column_name = sync_reference_images_schema.column_name
  ) INTO column_exists;

  IF column_exists THEN
    result := jsonb_build_object(
      'success', true,
      'message', 'Column already exists',
      'column_name', column_name,
      'action', 'skipped'
    );
  ELSE
    -- Add the column
    EXECUTE format(
      'ALTER TABLE reference_images ADD COLUMN %I %s',
      column_name,
      column_type
    );

    result := jsonb_build_object(
      'success', true,
      'message', 'Column added successfully',
      'column_name', column_name,
      'column_type', column_type,
      'action', 'created'
    );
  END IF;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'success', false,
      'message', SQLERRM,
      'column_name', column_name,
      'action', 'error'
    );
    RETURN result;
END;
$function$;

-- 4. Fix get_setting function
CREATE OR REPLACE FUNCTION public.get_setting(p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_value TEXT;
BEGIN
  SELECT setting_value INTO v_value
  FROM user_settings
  WHERE setting_key = p_key;

  RETURN v_value;
END;
$function$;

-- 5. Fix update_setting function
CREATE OR REPLACE FUNCTION public.update_setting(
  p_key text,
  p_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE user_settings
  SET setting_value = p_value,
      updated_at = NOW()
  WHERE setting_key = p_key;
END;
$function$;

-- Add comments
COMMENT ON FUNCTION public.increment_tag_usage IS 'Atomically increment tag usage count with fixed search_path';
COMMENT ON FUNCTION public.decrement_tag_usage IS 'Atomically decrement tag usage count (never below 0) with fixed search_path';
COMMENT ON FUNCTION public.sync_reference_images_schema IS 'Sync reference_images schema with vocabulary config with fixed search_path';
COMMENT ON FUNCTION public.get_setting IS 'Get application setting value with fixed search_path';
COMMENT ON FUNCTION public.update_setting IS 'Update application setting value with fixed search_path';
