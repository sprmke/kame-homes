-- Marketing AI image quality hardening, Phase 1e
-- (docs/workflow/planned/marketing-ai-image-quality-hardening.md).
--
-- Adds columns so a generation job can record the enhanced prompt actually sent to
-- Gemini alongside the host's original wording. `enhanced_prompt` is nullable and
-- null means "enhancement was off, skipped, or failed open" — a boolean flag would
-- collapse that into the same state as "enhanced to something short", so the two
-- columns are kept distinct on purpose. See marketingImagePromptBuilder.ts.
--
-- The existing `prompt` column caps at 2000 chars; an enhanced prompt is longer
-- than the host's raw text (which itself is capped at 1000 chars client + server
-- side via MAX_IMAGE_PROMPT_CHARS), so this gives it more headroom.

ALTER TABLE public.marketing_generation_jobs
  ADD COLUMN IF NOT EXISTS enhanced_prompt TEXT,
  ADD COLUMN IF NOT EXISTS prompt_enhanced BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.marketing_generation_jobs
  ADD CONSTRAINT marketing_generation_jobs_enhanced_prompt_len_check
    CHECK (enhanced_prompt IS NULL OR char_length(enhanced_prompt) BETWEEN 1 AND 4000);

COMMENT ON COLUMN public.marketing_generation_jobs.enhanced_prompt IS
  'Full scene description actually sent to the image model after prompt enhancement. Null when enhancement was disabled for the request, not applicable (video), or failed open and the job fell back to the host''s own prompt.';

COMMENT ON COLUMN public.marketing_generation_jobs.prompt_enhanced IS
  'True only when the enhancement call succeeded and its output was used. Distinguishes "not enhanced" from "enhanced_prompt happens to be null for another reason" — never infer this from enhanced_prompt IS NULL.';
