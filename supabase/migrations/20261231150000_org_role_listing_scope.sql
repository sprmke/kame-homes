-- Org role templates: default listing scope (properties / parkings) per template.

ALTER TABLE public.organization_custom_roles
  ADD COLUMN IF NOT EXISTS all_listings BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listing_assignments JSONB;

COMMENT ON COLUMN public.organization_custom_roles.all_listings IS
  'Default listing scope for members invited with this template — all org properties/parkings when true.';

COMMENT ON COLUMN public.organization_custom_roles.listing_assignments IS
  'Default per-listing assignments when all_listings is false: { properties: [...], parkings: [...] }.';

-- Full Access template → all listings (matches legacy org admin behavior).
UPDATE public.organization_custom_roles
SET all_listings = true
WHERE lower(trim(name)) = lower('Full Access');
