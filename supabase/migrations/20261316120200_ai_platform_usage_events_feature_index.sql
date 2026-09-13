-- Supports the per-feature monthly credit sub-cap query used by
-- _shared/marketingGenerationBudget.ts (SUM(credits_consumed) for one org + one
-- feature within the current month). Separate file so it can be applied on its own.
-- Plan: docs/workflow/planned/marketing-ai-asset-generation.md (§5)

CREATE INDEX IF NOT EXISTS idx_ai_platform_usage_events_org_feature_created
  ON public.ai_platform_usage_events (organization_id, feature, created_at DESC);
