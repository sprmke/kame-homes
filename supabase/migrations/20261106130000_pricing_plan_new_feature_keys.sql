-- Phase 2 of docs/workflow/in-progress/tier-feature-alignment-audit.md — new PlanFeatures keys.
-- Matrix: docs/architecture/plans-feature-matrix.md
--
-- financeReporting / maintenanceReporting / quickReplies / customTemplates / publicPagesAutosave: Starter+
-- metaChatChannel: Business+ (code `pro`) only — Meta chat is an external premium channel.
-- `commission` treated like `growth`/`starter` (Starter-equivalent tier) per the matrix's open-question recommendation.

UPDATE public.pricing_plans
SET features = features
  || '{
    "financeReporting": false,
    "maintenanceReporting": false,
    "metaChatChannel": false,
    "quickReplies": false,
    "customTemplates": false,
    "publicPagesAutosave": false
  }'::jsonb
WHERE code = 'free';

UPDATE public.pricing_plans
SET features = features
  || '{
    "financeReporting": true,
    "maintenanceReporting": true,
    "metaChatChannel": false,
    "quickReplies": true,
    "customTemplates": true,
    "publicPagesAutosave": true
  }'::jsonb
WHERE code IN ('starter', 'growth', 'commission');

UPDATE public.pricing_plans
SET features = features
  || '{
    "financeReporting": true,
    "maintenanceReporting": true,
    "metaChatChannel": true,
    "quickReplies": true,
    "customTemplates": true,
    "publicPagesAutosave": true
  }'::jsonb
WHERE code IN ('pro', 'managed');
