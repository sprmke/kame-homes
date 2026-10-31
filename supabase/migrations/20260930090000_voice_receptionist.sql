-- AI Voice Receptionist: global kill switch, per-property settings, session audit/caps,
-- and a source_mode column so voice turns show alongside text in the existing Inbox thread.
-- Everything defaults OFF -- opt-in per property, gated by the global switch.

CREATE TABLE IF NOT EXISTS public.voice_receptionist_global_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.voice_receptionist_global_settings (id, enabled)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.voice_receptionist_global_settings IS
  'Singleton platform kill switch for the AI voice receptionist. Checked before any property setting.';

CREATE TABLE IF NOT EXISTS public.voice_receptionist_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL UNIQUE REFERENCES public.properties (id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  voice_id TEXT NOT NULL DEFAULT 'Kore',
  persona_prompt TEXT,
  max_session_seconds INT NOT NULL DEFAULT 300,
  max_sessions_per_guest_per_day INT NOT NULL DEFAULT 3,
  max_concurrent_sessions INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT voice_receptionist_settings_session_seconds_check CHECK (max_session_seconds > 0),
  CONSTRAINT voice_receptionist_settings_guest_cap_check CHECK (max_sessions_per_guest_per_day > 0),
  CONSTRAINT voice_receptionist_settings_concurrent_cap_check CHECK (max_concurrent_sessions > 0)
);

COMMENT ON TABLE public.voice_receptionist_settings IS
  'Per-property AI voice receptionist configuration -- opt-in, defaults OFF.';

CREATE TABLE IF NOT EXISTS public.voice_receptionist_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  guest_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.social_conversations (id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  end_reason TEXT,
  estimated_cost_usd NUMERIC(10, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT voice_receptionist_sessions_end_reason_check CHECK (
    end_reason IS NULL OR end_reason IN ('guest_ended', 'timeout', 'cap_reached', 'error')
  )
);

COMMENT ON TABLE public.voice_receptionist_sessions IS
  'Audit/usage log for voice receptionist sessions -- backs cap enforcement and cost visibility.';

CREATE INDEX IF NOT EXISTS idx_voice_receptionist_sessions_property_started
  ON public.voice_receptionist_sessions (property_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_receptionist_sessions_guest_started
  ON public.voice_receptionist_sessions (guest_user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_receptionist_sessions_property_open
  ON public.voice_receptionist_sessions (property_id)
  WHERE ended_at IS NULL;

ALTER TABLE public.social_messages
  ADD COLUMN IF NOT EXISTS source_mode TEXT NOT NULL DEFAULT 'text';

ALTER TABLE public.social_messages
  DROP CONSTRAINT IF EXISTS social_messages_source_mode_check;
ALTER TABLE public.social_messages
  ADD CONSTRAINT social_messages_source_mode_check CHECK (source_mode IN ('text', 'voice'));

DROP TRIGGER IF EXISTS update_voice_receptionist_settings_updated_at ON public.voice_receptionist_settings;
CREATE TRIGGER update_voice_receptionist_settings_updated_at
  BEFORE UPDATE ON public.voice_receptionist_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS: edge functions use service_role for all reads/writes on these tables today.
ALTER TABLE public.voice_receptionist_global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_receptionist_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_receptionist_sessions ENABLE ROW LEVEL SECURITY;
