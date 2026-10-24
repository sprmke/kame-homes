-- AI Studio post versions keep the listing photos their spec's photoIndexes point into
-- (plan: docs/workflow/in-progress/marketing-ai-studio-sessions-and-library-polish.md §4).

ALTER TABLE public.marketing_ai_post_versions
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketing_ai_post_versions_photo_urls_check'
  ) THEN
    ALTER TABLE public.marketing_ai_post_versions
      ADD CONSTRAINT marketing_ai_post_versions_photo_urls_check
      CHECK (cardinality(photo_urls) <= 6);
  END IF;
END;
$$;

COMMENT ON COLUMN public.marketing_ai_post_versions.photo_urls IS
  'Listing photos the spec''s photoIndexes point into (allow-listed by the director call).';
