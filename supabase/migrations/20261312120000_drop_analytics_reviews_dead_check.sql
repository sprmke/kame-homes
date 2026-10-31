-- Cleanup: drop a leftover no-op CHECK constraint on property_analytics_reviews.
-- `CHECK (generated_by IS NOT NULL OR TRUE)` is a tautology (always evaluates true) — harmless
-- but meaningless, left over from an earlier draft of 20261308120000_host_analytics_foundation.sql.
-- Additive-only per repo convention (never edit a shipped migration).

ALTER TABLE public.property_analytics_reviews
  DROP CONSTRAINT IF EXISTS property_analytics_reviews_generated_by_check;
