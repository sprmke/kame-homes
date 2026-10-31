-- Persist property holiday / peak-season premium rules (calendar + booking rate math).

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS pricing_holiday_rules JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.app_settings.pricing_holiday_rules IS
  'Array of { id, name, startDate, endDate, percentage } — PH holiday premiums for pricing calendar and ReviewPricingForm.';

UPDATE public.app_settings
SET pricing_holiday_rules = '[
  {"id":"new-year","name":"New Year''s Day","startDate":"2026-01-01","endDate":"2026-01-01","percentage":50},
  {"id":"chinese-new-year","name":"Chinese New Year","startDate":"2026-02-17","endDate":"2026-02-17","percentage":30},
  {"id":"holy-week","name":"Holy Week","startDate":"2026-04-02","endDate":"2026-04-05","percentage":40},
  {"id":"labor-day","name":"Labor Day","startDate":"2026-05-01","endDate":"2026-05-01","percentage":20},
  {"id":"independence","name":"Independence Day","startDate":"2026-06-12","endDate":"2026-06-12","percentage":30},
  {"id":"peak-july","name":"Peak season","startDate":"2026-07-04","endDate":"2026-07-04","percentage":25},
  {"id":"all-saints","name":"All Saints'' Day","startDate":"2026-11-01","endDate":"2026-11-02","percentage":30},
  {"id":"christmas","name":"Christmas Season","startDate":"2026-12-24","endDate":"2026-12-26","percentage":50},
  {"id":"new-year-eve","name":"New Year''s Eve","startDate":"2026-12-31","endDate":"2026-12-31","percentage":50}
]'::jsonb
WHERE pricing_holiday_rules = '[]'::jsonb
  AND property_id IS NOT NULL;
