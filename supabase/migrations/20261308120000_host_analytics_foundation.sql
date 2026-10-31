-- Host Analytics module — foundation.
-- Plan: docs/workflow/in-progress/host-analytics-module.md
-- Matrix: docs/architecture/plans-feature-matrix.md
--
-- `property_analytics_reviews` — one row per generated AI Performance Review (weekly cron or
-- manual regenerate). `host_playbook_articles` — curated tips/tutorials the AI review and the
-- deterministic matcher point hosts at. `analyticsInsights` plan feature gates the whole
-- module (Pro `growth` and above).

BEGIN;

CREATE TABLE IF NOT EXISTS public.property_analytics_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  headline TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  score_delta INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_latest BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT property_analytics_reviews_generated_by_check CHECK (
    generated_by IS NOT NULL OR TRUE
  )
);

CREATE INDEX IF NOT EXISTS idx_property_analytics_reviews_property_generated
  ON public.property_analytics_reviews (property_id, generated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_analytics_reviews_latest
  ON public.property_analytics_reviews (property_id)
  WHERE is_latest;

COMMENT ON TABLE public.property_analytics_reviews IS
  'AI Performance Review outputs (weekly cron + on-demand regenerate). Advisory only — never mutates a rate or setting. is_latest marks the current review per property.';

ALTER TABLE public.property_analytics_reviews ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.property_analytics_reviews TO service_role;

-- ─── host_playbook_articles ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.host_playbook_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  applies_when JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT host_playbook_articles_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_host_playbook_articles_active_sort
  ON public.host_playbook_articles (is_active, sort_order);

COMMENT ON TABLE public.host_playbook_articles IS
  'Curated tips/tutorials matched against the analytics bundle (applies_when) and linked from AI Performance Review improvements[].';

ALTER TABLE public.host_playbook_articles ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.host_playbook_articles TO service_role;

DROP TRIGGER IF EXISTS update_host_playbook_articles_updated_at ON public.host_playbook_articles;
CREATE TRIGGER update_host_playbook_articles_updated_at
  BEFORE UPDATE ON public.host_playbook_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─── seed articles ──────────────────────────────────────────────────────────

INSERT INTO public.host_playbook_articles (slug, category, title, body_md, applies_when, sort_order)
VALUES
  ('raise-rates-when-fully-booked', 'pricing', 'Raise your rates before you sell out',
   'When a stretch of dates is fully booked, that''s the market telling you the price was too low. Raise the nightly rate for the next open window before demand drops off, not after.',
   '{"metric":"forwardOccupancyState","op":"eq","value":"fully_booked"}', 10),
  ('audit-blocked-dates', 'calendar hygiene', 'Audit your blocked dates',
   'Blocked dates that no longer need to be blocked are lost revenue. Review your calendar each month and release anything you''re not actually holding for maintenance, personal use, or a pending booking.',
   '{"metric":"forwardOccupancyState","op":"eq","value":"underbooked"}', 20),
  ('price-gap-check', 'pricing', 'Check your rate against your own baseline',
   'Compare your current nightly rate to your trailing 90-day average. A rate that has drifted well below your own baseline without a clear reason (off-season, extended stay discount) is worth revisiting.',
   '{"metric":"adr","op":"lt_baseline","value":0.85}', 30),
  ('enable-smart-pricing', 'pricing', 'Let Smart Pricing handle the daily adjustments',
   'Smart Pricing adjusts your nightly rate automatically based on demand signals, so you don''t have to manually chase occupancy swings. Turn it on from the Pricing page.',
   '{"metric":"smartPricingEnabled","op":"eq","value":false}', 40),
  ('respond-faster-improves-conversion', 'response time', 'Faster replies convert more inquiries',
   'Guests weigh response speed heavily when choosing between listings. Aim to reply within the hour during your active hours, and consider Quick Replies or AI auto-reply for common questions.',
   '{"metric":"responseWithin24hRate","op":"lt","value":0.8}', 50),
  ('collect-outstanding-balances', 'collections', 'Follow up on unpaid balances before check-in',
   'A booking with an outstanding balance close to check-in is a collections risk, not just an accounting note. Send a reminder as soon as a balance is flagged, well before the guest arrives.',
   '{"metric":"balanceCollectionState","op":"in","value":["attention_needed","at_risk"]}', 60),
  ('review-photos-quarterly', 'photos', 'Refresh your listing photos every season',
   'Listings with outdated or off-season photos underperform. Update your photo set to reflect the current season and any recent improvements to the space.',
   '{"metric":"forwardOccupancyState","op":"eq","value":"underbooked"}', 70),
  ('set-a-minimum-stay-strategically', 'pricing', 'Use minimum stays to protect high-demand dates',
   'On dates that are likely to book solid (holidays, weekends in peak season), a 2-3 night minimum stay reduces the risk of a single-night booking blocking a more valuable multi-night stay.',
   '{"metric":"forwardOccupancyState","op":"eq","value":"strong"}', 80),
  ('run-a-limited-promo', 'promos', 'Use a short, dated promo to fill a gap',
   'A discount that never expires trains guests to wait for a better deal. A short, dated promo on genuinely open dates creates urgency without permanently discounting your rate.',
   '{"metric":"forwardOccupancyState","op":"eq","value":"underbooked"}', 90),
  ('reply-to-every-review', 'reviews', 'Reply to every review, good or bad',
   'A thoughtful reply to a review — especially a critical one — signals to future guests that you''re an attentive host. It also gives you the last word on the listing page.',
   '{"metric":"ratingTrend","op":"lt","value":0}', 100),
  ('extend-your-calendar', 'calendar hygiene', 'Open your calendar further into the future',
   'Guests booking far in advance can''t book what isn''t open yet. If your calendar closes off after a short window, extending it captures early planners.',
   '{"metric":"forwardOccupancyState","op":"eq","value":"fully_booked"}', 110),
  ('highlight-amenities-in-title', 'listing content', 'Lead with your strongest amenity',
   'Your title and first photo do the most work in search results. Make sure they highlight the amenity or feature that matters most to your target guest (pool, parking, view, workspace).',
   '{"metric":"forwardOccupancyState","op":"eq","value":"underbooked"}', 120),
  ('channel-mix-diversify', 'marketing', 'Diversify where your bookings come from',
   'Relying on a single channel is a concentration risk. If one source dominates your bookings, test listing or promoting through another channel to reduce that dependency.',
   '{"metric":"channelConcentration","op":"gt","value":0.8}', 130),
  ('shorten-lead-time-gaps', 'pricing', 'Target your last-minute gap nights',
   'Nights close to today that are still unbooked rarely fill at full price. A modest last-minute discount on genuine gap nights is usually better than an empty night.',
   '{"metric":"gapNightsNext14d","op":"gt","value":0}', 140),
  ('keep-response-streak-going', 'response time', 'Keep up your fast response streak',
   'Your response time is in a strong range right now — keep the habits that got you there (notifications on, Quick Replies set up for common questions) so it doesn''t slip.',
   '{"metric":"responseWithin24hRate","op":"gte","value":0.9}', 150),
  ('review-cancellation-patterns', 'operations', 'Look for a pattern in recent cancellations',
   'A cluster of cancellations around the same dates or guest type can point to a listing description mismatch, a pricing issue, or a booking-window problem worth investigating.',
   '{"metric":"cancellationRate","op":"gt","value":0.15}', 160),
  ('publish-public-page-updates', 'listing content', 'Keep your public page current',
   'An outdated public page (old rates, stale availability messaging) undersells a listing that''s actually performing well. Republish after any meaningful change.',
   '{"metric":"forwardOccupancyState","op":"eq","value":"strong"}', 170)
ON CONFLICT (slug) DO NOTHING;

-- ─── analyticsInsights plan feature ─────────────────────────────────────────

UPDATE public.pricing_plans
SET features = features || '{ "analyticsInsights": false }'::jsonb
WHERE code IN ('free', 'starter', 'commission');

UPDATE public.pricing_plans
SET features = features || '{ "analyticsInsights": true }'::jsonb
WHERE code IN ('growth', 'pro', 'managed', 'business_plus');

COMMIT;
