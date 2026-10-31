-- AI validation results for the SD refund receipt (admin proof of refund transfer).

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS sd_refund_receipt_ai_verdict TEXT,
  ADD COLUMN IF NOT EXISTS sd_refund_receipt_ai_summary TEXT;

COMMENT ON COLUMN public.guest_submissions.sd_refund_receipt_ai_verdict IS
  'AI verdict for the SD refund receipt: valid, likely_valid, unclear, invalid, skipped';
COMMENT ON COLUMN public.guest_submissions.sd_refund_receipt_ai_summary IS
  'Short AI explanation for SD refund receipt validation';
