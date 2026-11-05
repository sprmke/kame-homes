-- Clear database linter 0011 (function_search_path_mutable) for the 24 public
-- functions that still relied on the caller's search_path.
--
-- Plan: docs/workflow/in-progress/supabase-capacity-and-operational-readiness.md
--
-- `public, extensions, pg_temp` is deliberate:
--   * public     - the tables and helper functions these routines own
--   * extensions - pg_trgm/unaccent, so a future search helper can call them
--   * pg_temp    - last, never before a real schema
--
-- The filter keeps already-pinned functions untouched, so the migration is safe
-- to replay and cannot silently widen an existing search_path.
--
-- activity-log: N/A (function attributes only; no row or org state changes).

DO $do$
DECLARE
  fn regprocedure;
  pinned_names text[] := ARRAY[
    'update_updated_at_column',
    'sync_property_city_from_settings',
    'unblock_parking_blocked_dates',
    'unblock_property_blocked_dates',
    'activity_log_block_mutation',
    'pls_trim',
    'pls_json_string',
    'pls_json_number',
    'pls_try_number',
    'pls_normalize_city_place',
    'pls_location_slug',
    'pls_slugify_name',
    'pls_property_place_label',
    'pls_listing_lat',
    'pls_listing_lng',
    'pls_haversine_km',
    'pls_external_review_stats',
    'pls_regex_escape',
    'pls_token_regex',
    'pls_field_rank',
    'pls_text_rank',
    'pls_terms_rank',
    'pls_flexible_date',
    'pls_jsonb_text_array'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (pinned_names)
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path TO public, extensions, pg_temp',
      fn
    );
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (pinned_names)
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
        WHERE c LIKE 'search_path=%'
      )
  ) THEN
    RAISE EXCEPTION 'pin_function_search_paths: some functions are still mutable';
  END IF;
END
$do$;
