-- Notification preferences — per-user push filtering (type groups + quiet hours).
-- Plan: docs/workflow/in-progress/pwa-v2-native-app-experience.md (Phase 6.2)
--
-- One row per user, global across organizations: the preference is about the
-- person and their devices ("do not buzz me for reviews at 2am"), not about a
-- tenant. In-app rows in `notifications` are never muted - the bell stays the
-- complete record; only the OS push is filtered (see push-fanout).
--
-- Absence of a row means "defaults" (nothing muted, quiet hours off), so no
-- backfill is needed and a user who never opens settings is unaffected.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  muted_groups TEXT[] NOT NULL DEFAULT '{}'::text[],
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00',
  quiet_hours_end TIME NOT NULL DEFAULT '07:00',
  quiet_hours_timezone TEXT NOT NULL DEFAULT 'Asia/Manila',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_preferences_muted_groups_check CHECK (
    muted_groups <@ ARRAY[
      'bookings',
      'inbox',
      'reviews',
      'pricing',
      'finance',
      'maintenance',
      'analytics',
      'system'
    ]::text[]
  ),
  CONSTRAINT notification_preferences_quiet_hours_check CHECK (
    quiet_hours_timezone <> ''
  )
);

COMMENT ON TABLE public.notification_preferences IS
  'Per-user OS push preferences: muted notification groups and quiet hours. In-app notifications are never filtered. Read by push-fanout; written by the notification-preferences edge function.';
COMMENT ON COLUMN public.notification_preferences.muted_groups IS
  'Type groups whose OS push is suppressed. Group keys mirror _shared/notificationPreferences.ts.';
COMMENT ON COLUMN public.notification_preferences.quiet_hours_timezone IS
  'IANA zone for the quiet window. Defaults to Asia/Manila (product timezone); the UI does not expose it yet.';

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_preferences_select_own ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notification_preferences_insert_own ON public.notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notification_preferences_update_own ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notification_preferences_delete_own ON public.notification_preferences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT ALL ON public.notification_preferences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
