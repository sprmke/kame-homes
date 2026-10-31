-- Guest public routes resolve ?property= by slug alone — slugs must be globally unique.
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_org_slug_unique;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_slug_unique UNIQUE (slug);
