-- Stay Guide now uses the same 6 `showcase-*` template keys as Property Showcase.
-- Plan: docs/workflow/in-progress/stay-guide-showcase-templates.md (Phase 2)
-- Runbook: docs/archive/operations/migration-runbook.md § 11a
--
-- Pre-v2 stay_guide custom_pages rows carry the legacy key `stay-guide-warm-arrival`
-- (or any non-`showcase-*` string). Point every such row at Aurora. `normalizeTemplateKey`
-- in `_shared/customPages.ts` also coerces unknown keys to `showcase-aurora` on read, so
-- this is a cleanup, not a correctness requirement.

UPDATE public.custom_pages
SET template_key = 'showcase-aurora',
    updated_at = now()
WHERE page_type = 'stay_guide'
  AND template_key NOT IN (
    'showcase-aurora',
    'showcase-monolith',
    'showcase-editorial',
    'showcase-verso',
    'showcase-atlas',
    'showcase-haven'
  );
