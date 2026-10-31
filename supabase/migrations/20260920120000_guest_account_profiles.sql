-- Guest account profiles, booking linkage, and avatar storage.

BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  phone TEXT,
  location_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT guest_profiles_display_name_len CHECK (
    display_name IS NULL OR char_length(display_name) <= 80
  ),
  CONSTRAINT guest_profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 500),
  CONSTRAINT guest_profiles_location_len CHECK (
    location_label IS NULL OR char_length(location_label) <= 120
  )
);

COMMENT ON TABLE public.guest_profiles IS
  'Guest-facing profile fields for signed-in explore users.';

ALTER TABLE public.guest_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY guest_profiles_select_own ON public.guest_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY guest_profiles_insert_own ON public.guest_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY guest_profiles_update_own ON public.guest_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.guest_profiles TO authenticated;

ALTER TABLE public.guest_submissions
  ADD COLUMN IF NOT EXISTS guest_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guest_submissions_guest_user_id
  ON public.guest_submissions (guest_user_id);

CREATE INDEX IF NOT EXISTS idx_guest_submissions_guest_user_email
  ON public.guest_submissions (guest_user_id, guest_email);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guest-profile-assets',
  'guest-profile-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
