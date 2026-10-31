-- Marketing Studio "Generate" tab — one row per AI image/video generation request.
-- Plan: docs/workflow/planned/marketing-ai-asset-generation.md (§2)
--
-- v1 produces exactly one output per request (Veo caps at 1; images are capped at 1
-- for cost predictability), so the output lives inline on the job row. If N-up image
-- grids are added later, add a child table and keep this as the header.
--
-- Phase 1 only writes 'image' rows and never leaves the request (inline generation,
-- same pattern as generate-marketing-template). The video columns, the 'finalizing'
-- status, and the claim-token columns ship now so Phase 2 is purely additive.

CREATE TABLE IF NOT EXISTS public.marketing_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,

  media_type TEXT NOT NULL,
  CONSTRAINT marketing_generation_jobs_media_type_check
    CHECK (media_type IN ('image', 'video')),

  job_status TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT marketing_generation_jobs_job_status_check
    CHECK (job_status IN ('pending', 'processing', 'finalizing', 'completed', 'failed', 'cancelled')),

  prompt TEXT NOT NULL,
  CONSTRAINT marketing_generation_jobs_prompt_len_check
    CHECK (char_length(prompt) BETWEEN 1 AND 2000),
  negative_prompt TEXT,

  model TEXT NOT NULL,
  quality_tier TEXT NOT NULL DEFAULT 'standard',
  CONSTRAINT marketing_generation_jobs_quality_tier_check
    CHECK (quality_tier IN ('draft', 'standard', 'premium')),
  aspect_ratio TEXT NOT NULL DEFAULT '1:1',
  image_size TEXT,
  resolution TEXT,
  duration_seconds INT,
  CONSTRAINT marketing_generation_jobs_duration_check
    CHECK (duration_seconds IS NULL OR duration_seconds IN (6, 8)),

  reference_paths TEXT[] NOT NULL DEFAULT '{}',
  reference_urls TEXT[] NOT NULL DEFAULT '{}',

  provider TEXT NOT NULL DEFAULT 'gemini',
  provider_operation_name TEXT,
  provider_poll_count INT NOT NULL DEFAULT 0,
  last_provider_poll_at TIMESTAMPTZ,

  finalize_claim_token UUID,
  finalize_claimed_at TIMESTAMPTZ,

  output_storage_path TEXT,
  output_url TEXT,
  output_mime_type TEXT,
  output_bytes BIGINT,
  output_width INT,
  output_height INT,

  estimated_credits INT NOT NULL DEFAULT 0,
  credits_consumed INT,
  estimated_cost_usd NUMERIC(12, 6),
  usage_event_id UUID,
  usage_recorded_at TIMESTAMPTZ,

  error_code TEXT,
  error_message TEXT,

  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.marketing_generation_jobs IS
  'Marketing Studio AI asset generation — one row per image/video request, output inline.';
COMMENT ON COLUMN public.marketing_generation_jobs.job_status IS
  'pending → processing → finalizing → completed | failed | cancelled. Images skip processing/finalizing (inline).';
COMMENT ON COLUMN public.marketing_generation_jobs.duration_seconds IS
  'Video only. 4s is deliberately not allowed: Meta Reels requires 5-90s, so a 4s clip is unpublishable.';
COMMENT ON COLUMN public.marketing_generation_jobs.provider_operation_name IS
  'Veo long-running operation name. Unique so a retry can never fan out into two finalizations.';
COMMENT ON COLUMN public.marketing_generation_jobs.finalize_claim_token IS
  'Compare-and-swap token guarding the double-finalize race between concurrent pollers and the cron sweeper.';
COMMENT ON COLUMN public.marketing_generation_jobs.estimated_credits IS
  'Gate-time reservation used for in-flight credit accounting. credits_consumed is the actual post-call charge.';
COMMENT ON COLUMN public.marketing_generation_jobs.usage_recorded_at IS
  'Set when recordAiUsage succeeded. NULL on a completed row means the sweeper billing-repair pass still owes a charge.';
COMMENT ON COLUMN public.marketing_generation_jobs.expires_at IS
  'In-flight deadline. Past this the sweeper fails the job as timeout without charging.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_generation_jobs_provider_operation
  ON public.marketing_generation_jobs (provider_operation_name)
  WHERE provider_operation_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_generation_jobs_property_created
  ON public.marketing_generation_jobs (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_generation_jobs_org_created
  ON public.marketing_generation_jobs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_generation_jobs_sweeper
  ON public.marketing_generation_jobs (expires_at)
  WHERE job_status IN ('pending', 'processing', 'finalizing');
CREATE INDEX IF NOT EXISTS idx_marketing_generation_jobs_inflight
  ON public.marketing_generation_jobs (organization_id, property_id)
  WHERE job_status IN ('pending', 'processing', 'finalizing');
CREATE INDEX IF NOT EXISTS idx_marketing_generation_jobs_billing_repair
  ON public.marketing_generation_jobs (completed_at)
  WHERE job_status = 'completed' AND usage_recorded_at IS NULL;

DROP TRIGGER IF EXISTS update_marketing_generation_jobs_updated_at ON public.marketing_generation_jobs;
CREATE TRIGGER update_marketing_generation_jobs_updated_at
  BEFORE UPDATE ON public.marketing_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Service-role only, same as booking_ai_reviews: access control lives in the edge
-- functions (resolveScopedPropertyAccess + requirePropertyPermissionAndFeature).
ALTER TABLE public.marketing_generation_jobs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.marketing_generation_jobs TO service_role;
