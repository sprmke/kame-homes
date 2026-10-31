-- Hardening pass on the AI credit foundation (Phases 1-3), found in code review before
-- shipping:
--
-- 1. increment_ai_platform_usage_daily / increment_ai_platform_property_usage_daily were
--    "re-declared" with an extra p_credits_consumed parameter via CREATE OR REPLACE FUNCTION
--    in 20261022140000_ai_credit_foundation.sql. Postgres identifies functions by
--    (name, parameter-type-list), so a different parameter count is a distinct overload, not
--    a replacement — the original 6-argument functions were never removed and are now dead,
--    stale duplicates that silently skip credits_consumed if anything ever calls them with
--    only 6 args. Drop them explicitly.
--
-- 2. ai_platform_org_credit_wallet.balance_credits was updated via a plain
--    SELECT-then-.upsert() round trip in application code (aiCreditLedger.ts), unlike every
--    other counter this feature added (which use atomic increment_* RPCs). That is a real
--    lost-update race under concurrent debits/adjustments on the one field in this feature
--    closest to real money — not equivalent to the accepted "gate-then-act" TOCTOU tradeoff
--    used for call-count limits elsewhere, since here the *write itself* was non-atomic. This
--    RPC does the read-clamp-write inside one call (row-level lock via SELECT ... FOR UPDATE)
--    and returns the delta actually applied after clamping to >= 0, so the caller can record
--    a ledger entry that reconciles with the real balance history instead of the raw
--    requested delta.

DROP FUNCTION IF EXISTS public.increment_ai_platform_usage_daily(UUID, DATE, INT, BIGINT, BIGINT, NUMERIC);
DROP FUNCTION IF EXISTS public.increment_ai_platform_property_usage_daily(UUID, UUID, DATE, INT, BIGINT, BIGINT, NUMERIC);

CREATE OR REPLACE FUNCTION public.adjust_ai_platform_org_credit_wallet(
  p_organization_id UUID,
  p_credits_delta NUMERIC
)
RETURNS TABLE(balance_credits NUMERIC, applied_delta NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous NUMERIC;
  v_next NUMERIC;
BEGIN
  -- Ensure a row exists, then lock it for the rest of this call so concurrent adjustments
  -- for the same org serialize instead of racing on a plain read-then-write.
  INSERT INTO public.ai_platform_org_credit_wallet (organization_id, balance_credits)
  VALUES (p_organization_id, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT w.balance_credits INTO v_previous
  FROM public.ai_platform_org_credit_wallet w
  WHERE w.organization_id = p_organization_id
  FOR UPDATE;

  v_next := GREATEST(0, v_previous + p_credits_delta);

  UPDATE public.ai_platform_org_credit_wallet
  SET balance_credits = v_next, updated_at = NOW()
  WHERE organization_id = p_organization_id;

  RETURN QUERY SELECT v_next, (v_next - v_previous);
END;
$$;

COMMENT ON FUNCTION public.adjust_ai_platform_org_credit_wallet IS
  'Atomic read-clamp-write for the org credit wallet balance. Returns the new balance and the delta actually applied after clamping to >= 0 — use applied_delta (not the raw requested delta) when recording the ledger entry so it reconciles with real balance history.';

GRANT EXECUTE ON FUNCTION public.adjust_ai_platform_org_credit_wallet(UUID, NUMERIC) TO service_role;
