-- Owner-managed date blocks per property (Pricing/Calendar "Blocked" nights).
-- Nights covered: [start_date, end_date) -- checkout-exclusive, matches booking occupancy.

CREATE TABLE public.property_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT property_blocked_dates_range_chk CHECK (end_date > start_date)
);

CREATE INDEX property_blocked_dates_property_range_idx
  ON public.property_blocked_dates (property_id, start_date, end_date);

ALTER TABLE public.property_blocked_dates ENABLE ROW LEVEL SECURITY;

-- Access control is enforced in edge functions (service role); no direct client access.
GRANT ALL ON public.property_blocked_dates TO service_role;
