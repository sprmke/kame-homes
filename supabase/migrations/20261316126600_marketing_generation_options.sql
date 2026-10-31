-- Marketing AI video quality (docs/workflow/in-progress/marketing-ai-video-quality.md).
--
-- Video jobs now carry creative direction that has no dedicated column: camera move
-- and sound mode. Stored as a small JSONB bag so "Edit and retry" can restore the
-- composer and future options do not need a column each. Validated server-side in
-- generate-marketing-media before insert; the column only enforces "is an object".

ALTER TABLE public.marketing_generation_jobs
  ADD COLUMN IF NOT EXISTS generation_options JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.marketing_generation_jobs
  ADD CONSTRAINT marketing_generation_jobs_generation_options_object_check
    CHECK (jsonb_typeof(generation_options) = 'object');

COMMENT ON COLUMN public.marketing_generation_jobs.generation_options IS
  'Creative options without their own column. Video: { cameraMove, sound }. Empty object for image jobs and for video jobs created before this column existed.';
