-- Fixes the billing-repair partial index to match the actual "not billed yet" query.
--
-- usage_recorded_at is a CLAIM timestamp (see claimMarketingGenerationJobBilling in
-- _shared/marketingGenerationJobs.ts) — it is set atomically before recordAiUsage runs,
-- specifically so a crash between the claim and the real usage-event write can never be
-- mistaken for "never billed" and double-charged on repair. That means credits_consumed,
-- not usage_recorded_at, is the column that actually means "billing succeeded." The
-- index created in 20261316120000 predates that design and still keys off
-- usage_recorded_at IS NULL, which the repair query no longer uses as its sole filter.

DROP INDEX IF EXISTS public.idx_marketing_generation_jobs_billing_repair;

CREATE INDEX IF NOT EXISTS idx_marketing_generation_jobs_billing_repair
  ON public.marketing_generation_jobs (completed_at)
  WHERE job_status = 'completed' AND credits_consumed IS NULL;
