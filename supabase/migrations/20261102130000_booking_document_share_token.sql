-- Per-booking durable share token for private approved-document PDFs (GAF, Pet).
-- Mirrors stay_guide_token (20260916120000_guest_stay_guide_token.sql) but with no
-- validity window — approval proof is useful any time after approval, not stay-dated.

ALTER TABLE guest_submissions
  ADD COLUMN IF NOT EXISTS document_share_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_submissions_document_share_token
  ON guest_submissions (document_share_token)
  WHERE document_share_token IS NOT NULL;

COMMENT ON COLUMN guest_submissions.document_share_token IS
  'Opaque token for /properties/:slug/document?token=&doc=gaf|pet — issued on demand from the Inbox share picker or booking Files tab. One token unlocks both approved documents for the booking.';
