-- Platform-wide host dashboard announcements (singleton settings row).

CREATE TABLE IF NOT EXISTS public.platform_host_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  announcements JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_host_settings_singleton CHECK (id = TRUE)
);

INSERT INTO public.platform_host_settings (id, announcements)
VALUES (TRUE, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.platform_host_settings IS
  'Singleton platform settings for host dashboard UX — announcements for all orgs.';

DROP TRIGGER IF EXISTS update_platform_host_settings_updated_at ON public.platform_host_settings;
CREATE TRIGGER update_platform_host_settings_updated_at
  BEFORE UPDATE ON public.platform_host_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.platform_host_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_host_settings_select
  ON public.platform_host_settings
  FOR SELECT
  TO authenticated
  USING (TRUE);

GRANT SELECT ON public.platform_host_settings TO authenticated;
GRANT ALL ON public.platform_host_settings TO service_role;
