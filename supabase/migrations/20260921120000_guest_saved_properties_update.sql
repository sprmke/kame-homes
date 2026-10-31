-- Upsert on guest_saved_properties uses ON CONFLICT DO UPDATE, which requires UPDATE grant + policy.

CREATE POLICY "Guests update own saved properties"
  ON public.guest_saved_properties
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT UPDATE ON public.guest_saved_properties TO authenticated;
