-- Per-booking guest stay guide access token (shareable brochure page during stay window).

ALTER TABLE guest_submissions
  ADD COLUMN IF NOT EXISTS stay_guide_token TEXT,
  ADD COLUMN IF NOT EXISTS stay_guide_valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stay_guide_valid_until TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_submissions_stay_guide_token
  ON guest_submissions (stay_guide_token)
  WHERE stay_guide_token IS NOT NULL;

COMMENT ON COLUMN guest_submissions.stay_guide_token IS
  'Opaque token for /properties/:slug/stay-guide?token= — issued on READY_FOR_CHECKIN.';
COMMENT ON COLUMN guest_submissions.stay_guide_valid_from IS
  'Asia/Manila check-in day 00:00 — earliest guest access.';
COMMENT ON COLUMN guest_submissions.stay_guide_valid_until IS
  'Asia/Manila day after check-out 23:59:59 — latest guest access.';
