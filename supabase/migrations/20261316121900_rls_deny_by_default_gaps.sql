-- RLS coverage audit — production-readiness doc 22 "Security & RLS", Phase 22.1.
--
-- Full RLS sweep against a running local Postgres (2026-09-18): 114 public
-- tables, 111 already RLS-enabled (87 deny-by-default with zero policies,
-- 24 with explicit tenant-scoped policies). Three tables were missed at
-- creation time and never had RLS enabled:
--
--   developments      — 20260719100000_developments.sql, edge-function-only access
--   processed_emails  — 20260501000005_create_processed_emails_table.sql, edge-only
--   query_cache       — 20261316121700_query_cache_table.sql, edge-only (this pass)
--
-- Verified each has zero `ui/src` or direct-browser callers (grep across
-- `supabase/functions/**` and `ui/src/**` for `.from('<table>')`) — every read
-- and write goes through an edge function using the service-role client,
-- which bypasses RLS entirely. RLS here is defense-in-depth, not the primary
-- control (doc 21 edge-function checks are); the correct posture per doc 22
-- is "RLS enabled, no permissive policy" — service role still works,
-- anon/authenticated get nothing even if a future code change (or the
-- lingering GRANT TRUNCATE/REFERENCES/TRIGGER default privileges found on
-- these three tables) exposes a path that was not anticipated.
--
-- Also revokes the default-privilege TRUNCATE/REFERENCES/TRIGGER grants that
-- anon/authenticated held on these three tables (schema-level `GRANT ALL ON
-- ALL TABLES IN SCHEMA public` residue, not something any migration
-- intentionally granted) — TRUNCATE in particular is a real DoS vector: an
-- anon-keyed client could otherwise empty query_cache/processed_emails/
-- developments outright even without SELECT/INSERT/UPDATE/DELETE.

ALTER TABLE public.developments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_cache ENABLE ROW LEVEL SECURITY;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.developments FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.processed_emails FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.query_cache FROM anon, authenticated;

COMMENT ON TABLE public.developments IS
  'RLS enabled with no policy (doc 22 Phase 22.1) — edge-function/service-role access only, no direct browser reads.';
COMMENT ON TABLE public.processed_emails IS
  'RLS enabled with no policy (doc 22 Phase 22.1) — edge-function/service-role access only (approval-email-webhook), no direct browser reads.';
COMMENT ON TABLE public.query_cache IS
  'RLS enabled with no policy (doc 22 Phase 22.1) — edge-function/service-role access only (_shared/queryCache.ts), no direct browser reads.';
