-- Parking-scoped finance line items (operating income/expense per parking slot).
-- Exactly one of property_id or parking_id must be set on each row.

ALTER TABLE public.finance_line_items
  ADD COLUMN IF NOT EXISTS parking_id UUID REFERENCES public.parkings (id) ON DELETE CASCADE;

ALTER TABLE public.finance_line_items
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE public.finance_line_items
  DROP CONSTRAINT IF EXISTS finance_line_items_asset_scope_check;

ALTER TABLE public.finance_line_items
  ADD CONSTRAINT finance_line_items_asset_scope_check CHECK (
    ((property_id IS NOT NULL)::int + (parking_id IS NOT NULL)::int) = 1
  );

CREATE INDEX IF NOT EXISTS idx_finance_line_items_parking_id
  ON public.finance_line_items (parking_id);

COMMENT ON COLUMN public.finance_line_items.parking_id IS
  'Parking-scoped operating finance line. Mutually exclusive with property_id.';
