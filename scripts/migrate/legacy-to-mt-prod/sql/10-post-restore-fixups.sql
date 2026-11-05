-- 10-post-restore-fixups.sql — pre-upgrade data fixes for real legacy anomalies.
-- Plan: docs/workflow/planned/kamespace-02-legacy-prod-to-mt-prod-cutover.md §2.3 / §0.2 drift findings.
--
-- Each fixup is narrowly scoped, commented with WHY, and idempotent. Anything
-- judgment-based is marked HOST-SIGN-OFF until the host confirms.
--
-- [F1] guest_submissions.balance_nonneg NOT-VIOLATING rows found in R1
--      (2026-10-24): legacy stores `balance = -security_deposit` on COMPLETED
--      bookings whose guest balance was fully settled (deposit refunded in
--      full, balance receipt captured). The legacy CHECK `balance_nonneg` is
--      NOT VALID in the legacy schema, so these dormant rows only surface when
--      a later stage UPDATEs them (e.g. the storage-URL rewrite).
--
--      HOST-SIGN-OFF: normalize `balance` to 0 for COMPLETED rows with
--      balance = -security_deposit (fully settled). If negative balance means
--      "guest is owed money" in another flow, keep the value and instead run
--      the rewrite with the constraint's NOT VALID state preserved per-row.
UPDATE public.guest_submissions
SET balance = 0
WHERE status = 'COMPLETED'
  AND balance IS NOT NULL
  AND balance < 0
  AND balance = -security_deposit;

-- [F2] storage-host drift: rows referencing the LEGACY storage host with the
-- www apex variant are normalized during 30-rewrite; nothing needed here yet.
