-- Org Activity & Audit Log — Phase 6: plan gate for CSV export.
-- Plan:   docs/workflow/in-progress/org-activity-audit-log.md  (Phase 6, Open question 1)
-- Matrix: docs/architecture/plans-feature-matrix.md
--
-- `activityLogExport` — downloading the Activity & Audit Log as CSV
-- (activity-log-export edge fn + the "Export CSV" button). In-app viewing of the
-- log stays ungated on every plan (GET/list convention). Same gate shape as
-- `financeReporting` / `maintenanceReporting`: Starter (`starter` / `commission`)
-- and above.

UPDATE public.pricing_plans
SET features = features || '{ "activityLogExport": false }'::jsonb
WHERE code = 'free';

UPDATE public.pricing_plans
SET features = features || '{ "activityLogExport": true }'::jsonb
WHERE code IN ('starter', 'commission', 'growth', 'pro', 'managed', 'business_plus');
