-- AI chat mode Phase 6: per-module golden eval runs for the dashboard assistant.
-- Written by `bun run eval:ai -- --suite assistant --record` (service role); read by
-- super-admin-ai-usage. No tenant data: dataset ids and pass counts only.

CREATE TABLE IF NOT EXISTS public.ai_assistant_eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  routed boolean NOT NULL DEFAULT false,
  passed integer NOT NULL CHECK (passed >= 0),
  total integer NOT NULL CHECK (total > 0 AND passed <= total),
  avg_tools_sent numeric(6, 1),
  prompt_version text,
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  failed_case_ids text[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_ai_assistant_eval_runs_created
  ON public.ai_assistant_eval_runs (created_at DESC);

ALTER TABLE public.ai_assistant_eval_runs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ai_assistant_eval_runs TO service_role;
REVOKE ALL ON public.ai_assistant_eval_runs FROM anon, authenticated;
