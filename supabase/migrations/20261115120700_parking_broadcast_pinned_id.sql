-- Phase 2 match engine: track whether a parking request was pinned to one specific listing
-- (guest requested that listing directly) vs an org-wide search, so batch-advance can keep
-- pinned requests single-round instead of silently broadening them to other org parkings.

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS parking_pinned_id UUID REFERENCES public.parkings(id);

COMMENT ON COLUMN public.guest_submissions.parking_pinned_id IS
  'Set when the guest requested one specific listing directly (not an org-wide search). Pinned '
  'requests stay single-round -- advanceOrTerminateParkingBatch never expands them to other '
  'parkings in the org once their one candidate''s batch is exhausted.';
