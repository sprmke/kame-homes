-- Fix: property_template_contents was created without service_role GRANTs (42501 from edge).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_template_contents TO service_role;
