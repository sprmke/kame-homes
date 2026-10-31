-- Guest wishlist: saved properties per authenticated guest (Supabase Auth user).

CREATE TABLE IF NOT EXISTS public.guest_saved_properties (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  property_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, property_slug),
  CONSTRAINT guest_saved_properties_slug_format CHECK (
    property_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

CREATE INDEX IF NOT EXISTS idx_guest_saved_properties_property_slug
  ON public.guest_saved_properties (property_slug);

COMMENT ON TABLE public.guest_saved_properties IS
  'Guest wishlist rows keyed by public property slug. Scoped to auth.uid() via RLS.';

ALTER TABLE public.guest_saved_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guests read own saved properties"
  ON public.guest_saved_properties
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Guests insert own saved properties"
  ON public.guest_saved_properties
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Guests delete own saved properties"
  ON public.guest_saved_properties
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.guest_saved_properties TO authenticated;
