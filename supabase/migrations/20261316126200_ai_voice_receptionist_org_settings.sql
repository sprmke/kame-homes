-- Voice receptionist config moves to the organization (one voice + persona per org, plus a
-- per-property opt-out list, mirroring ai_dashboard_assistant_org_settings). The guest runtime
-- resolves each property's config from this row. Session limit overrides stay on
-- ai_platform_property_settings.feature_configs (super-admin only).

CREATE TABLE IF NOT EXISTS public.ai_voice_receptionist_org_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  voice_id TEXT NOT NULL DEFAULT 'Kore',
  persona_prompt TEXT,
  disabled_property_ids UUID[] NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_voice_receptionist_org_settings_persona_length_check
    CHECK (persona_prompt IS NULL OR char_length(persona_prompt) <= 300)
);

COMMENT ON TABLE public.ai_voice_receptionist_org_settings IS
  'Org-level voice receptionist opt-in, voice, persona, and per-property opt-out list.';

DROP TRIGGER IF EXISTS update_ai_voice_receptionist_org_settings_updated_at
  ON public.ai_voice_receptionist_org_settings;
CREATE TRIGGER update_ai_voice_receptionist_org_settings_updated_at
  BEFORE UPDATE ON public.ai_voice_receptionist_org_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.ai_voice_receptionist_org_settings ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ai_voice_receptionist_org_settings TO service_role;
REVOKE ALL ON public.ai_voice_receptionist_org_settings FROM anon, authenticated;

-- Backfill from per-property configs. Org is on when any property had voice on; properties that
-- were off (or never configured) land in the opt-out list so nothing starts answering by surprise.
-- Voice + persona come from the most recently updated configured property.
WITH property_voice AS (
  SELECT
    p.organization_id,
    p.id AS property_id,
    COALESCE((s.feature_configs -> 'voice_receptionist' ->> 'enabled')::BOOLEAN, FALSE)
      AND COALESCE(s.enabled, TRUE) AS voice_on,
    NULLIF(s.feature_configs -> 'voice_receptionist' ->> 'voice_id', '') AS voice_id,
    NULLIF(s.feature_configs -> 'voice_receptionist' ->> 'persona_prompt', '') AS persona_prompt,
    s.updated_at
  FROM public.properties p
  LEFT JOIN public.ai_platform_property_settings s ON s.property_id = p.id
),
org_rollup AS (
  SELECT
    organization_id,
    BOOL_OR(voice_on) AS enabled,
    COALESCE(
      ARRAY_AGG(property_id) FILTER (WHERE NOT voice_on),
      '{}'
    ) AS off_property_ids
  FROM property_voice
  GROUP BY organization_id
  HAVING BOOL_OR(voice_id IS NOT NULL OR voice_on)
),
latest_config AS (
  SELECT DISTINCT ON (organization_id)
    organization_id,
    voice_id,
    persona_prompt
  FROM property_voice
  WHERE voice_id IS NOT NULL OR persona_prompt IS NOT NULL
  ORDER BY organization_id, voice_on DESC, updated_at DESC NULLS LAST
)
INSERT INTO public.ai_voice_receptionist_org_settings (
  organization_id,
  enabled,
  voice_id,
  persona_prompt,
  disabled_property_ids
)
SELECT
  r.organization_id,
  r.enabled,
  COALESCE(l.voice_id, 'Kore'),
  LEFT(l.persona_prompt, 300),
  CASE WHEN r.enabled THEN r.off_property_ids ELSE '{}'::UUID[] END
FROM org_rollup r
LEFT JOIN latest_config l ON l.organization_id = r.organization_id
ON CONFLICT (organization_id) DO NOTHING;
