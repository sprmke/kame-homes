-- Airbnb / OTA two-way calendar sync — Phase 1.
-- Plan: docs/workflow/done/airbnb-calendar-sync.md §5.1 / §5.2
--
-- property_calendar_feeds  : external iCal URLs we poll (Airbnb / Booking.com / VRBO / other)
-- property_calendar_export : per-property token for the outbound text/calendar feed OTAs import
--
-- Access control is enforced in edge functions (service role); RLS on, no policies
-- (mirrors property_blocked_dates / finance_line_items).

CREATE TABLE public.property_calendar_feeds (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id          uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  provider             text NOT NULL CHECK (provider IN ('airbnb', 'booking_com', 'vrbo', 'other')),
  label                text,
  -- AES-256-GCM ciphertext (GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY). The URL usually embeds a secret.
  ics_url_encrypted    text NOT NULL,
  is_active            boolean NOT NULL DEFAULT true,
  -- Phase 2 opt-in: also create guest_submissions rows from reservation VEVENTs. Phase 1 forces false.
  create_bookings      boolean NOT NULL DEFAULT false,
  -- health / sync state
  last_attempted_at    timestamptz,
  last_success_at      timestamptz,
  last_error           text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  -- truncation guard: number of consecutive pulls that parsed a valid but empty VCALENDAR
  empty_pull_streak    integer NOT NULL DEFAULT 0,
  last_etag            text,
  last_modified_header text,
  last_feed_hash       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX property_calendar_feeds_property_idx
  ON public.property_calendar_feeds (property_id) WHERE is_active;

CREATE INDEX property_calendar_feeds_sweep_idx
  ON public.property_calendar_feeds (last_attempted_at NULLS FIRST) WHERE is_active;

COMMENT ON COLUMN public.property_calendar_feeds.ics_url_encrypted IS
  'AES-256-GCM encrypted external iCal URL (property-scoped). Decrypt only inside edge functions.';
COMMENT ON COLUMN public.property_calendar_feeds.create_bookings IS
  'Phase 2: promote reservation VEVENTs to guest_submissions rows (held in PENDING_REVIEW). Phase 1 forces false.';

ALTER TABLE public.property_calendar_feeds ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.property_calendar_feeds TO service_role;

CREATE TABLE public.property_calendar_export (
  property_id    uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  -- >=32 bytes CSPRNG, base64url. This IS the credential — stored plaintext, rotatable.
  token          text NOT NULL,
  is_enabled     boolean NOT NULL DEFAULT true,
  rotated_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_served_at timestamptz
);

CREATE UNIQUE INDEX property_calendar_export_token_key
  ON public.property_calendar_export (token);

COMMENT ON TABLE public.property_calendar_export IS
  'One row per property, lazily created on first read. token guards GET /functions/v1/ical-export.';

ALTER TABLE public.property_calendar_export ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.property_calendar_export TO service_role;
