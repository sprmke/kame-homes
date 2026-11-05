-- Cutover watermark (restore-then-upgrade guard) — plan §5.6 of
-- docs/workflow/planned/legacy-prod-to-mt-prod-cutover.md.
--
-- migration_cutover_at marks the moment legacy production data was migrated
-- into this project. Cron sweeps that send guest-facing messages (review
-- lifecycle fallback in particular) treat bookings whose stay happened BEFORE
-- this timestamp as settled history: no review windows, no request emails, no
-- reminders — those guests were already handled by the legacy stack.
--
-- NULL (default) = no cutover yet; every guard is inactive, which is correct
-- behavior for mt-dev and for a legacy-era DB operating as itself. The shaping
-- script sets the value at cutover T0. Super-admin can clear/adjust it via
-- platform-settings after hypercare.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS migration_cutover_at TIMESTAMPTZ;

COMMENT ON COLUMN public.platform_settings.migration_cutover_at IS
  'Legacy → mt-prod cutover marker (plan section 5.6). Cron sweeps skip bookings whose stay '
  'predates this for guest-facing sends — no historic review-request/reminder blasts. '
  'NULL = no cutover (guards inactive). Set by the migration shaping script at T0.';
