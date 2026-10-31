-- Listing-level authorization (verification scope split — Host vs Listing).
--
-- Adds the private bucket for per-listing authorization proofs and backfills
-- properties.settings.listingAuthorization / parkings.settings.listingAuthorization
-- from the matching organizations.settings.verification leg.
--
-- Non-destructive: the org verification block is left untouched (edge parsers keep reading it
-- as a fallback via resolveListingAuthorization), and rows that already carry a
-- listingAuthorization object are skipped.

-- ---------------------------------------------------------------------------
-- Storage: per-listing authorization proofs. PRIVATE — service role only.
-- Paths live in the listing's settings.listingAuthorization.assets.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-authorization-assets',
  'listing-authorization-assets',
  FALSE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Service role full access to listing-authorization-assets" ON storage.objects;

CREATE POLICY "Service role full access to listing-authorization-assets"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'listing-authorization-assets')
  WITH CHECK (bucket_id = 'listing-authorization-assets');

-- ---------------------------------------------------------------------------
-- Backfill helper: build a listingAuthorization block from one org verification leg.
-- leg = 'property' | 'parking'. Dropped at the end of this migration.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.listing_authorization_from_org_leg(
  org_verification JSONB,
  leg TEXT
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'relationship', COALESCE(
      v -> (CASE WHEN leg = 'parking' THEN 'parkingRelationship' ELSE 'propertyRelationship' END),
      'null'::jsonb
    ),
    'contractEndDate', COALESCE(
      v -> (CASE WHEN leg = 'parking' THEN 'parkingContractEndDate' ELSE 'propertyContractEndDate' END),
      'null'::jsonb
    ),
    'baseStatus', COALESCE(v -> 'baseStatus', '"none"'::jsonb),
    'recommendedStatus', '"none"'::jsonb,
    'baseSubmittedAt', COALESCE(v -> 'baseSubmittedAt', 'null'::jsonb),
    'recommendedSubmittedAt', 'null'::jsonb,
    'baseRejectionReason', COALESCE(v -> 'baseRejectionReason', 'null'::jsonb),
    'recommendedRejectionReason', 'null'::jsonb,
    'baseRejectionKind', CASE
      WHEN v ->> 'baseStatus' = 'rejected'
        THEN COALESCE(v -> 'baseRejectionKind', '"rejected"'::jsonb)
      ELSE 'null'::jsonb
    END,
    'recommendedRejectionKind', 'null'::jsonb,
    'assets', jsonb_build_object(
      'proofPath', COALESCE(
        (v -> 'assets') -> (CASE
          WHEN leg = 'parking' THEN 'parkingSocialProofPath'
          ELSE 'propertyOwnershipProofPath'
        END),
        'null'::jsonb
      ),
      'additionalProofPath', COALESCE((v -> 'assets') -> 'ownershipProofPath', 'null'::jsonb),
      'azurePmoConfirmationPath', COALESCE(
        (v -> 'assets') -> 'azurePmoConfirmationPath',
        (v -> 'assets') -> 'opsProofPath',
        'null'::jsonb
      )
    ),
    'lifecycle', COALESCE(
      v -> (CASE WHEN leg = 'parking' THEN 'parkingLifecycle' ELSE 'propertyLifecycle' END),
      jsonb_build_object(
        'noticesSent', '{}'::jsonb,
        'accessLockedAt', 'null'::jsonb,
        'consideration', jsonb_build_object(
          'status', 'none',
          'note', 'null'::jsonb,
          'expectedDate', 'null'::jsonb,
          'grantedUntil', 'null'::jsonb,
          'proofPaths', '[]'::jsonb,
          'audit', '[]'::jsonb,
          'selfServeUsedThisCycle', FALSE,
          'allowConsiderationOverride', FALSE
        )
      )
    )
  )
  FROM (
    SELECT CASE
      WHEN jsonb_typeof(org_verification) = 'object' THEN org_verification
      ELSE '{}'::jsonb
    END AS v
  ) AS src;
$$;

-- ---------------------------------------------------------------------------
-- Backfill properties
-- ---------------------------------------------------------------------------

UPDATE public.properties AS p
SET settings = p.settings || jsonb_build_object(
      'listingAuthorization',
      public.listing_authorization_from_org_leg(o.settings -> 'verification', 'property')
    )
FROM public.organizations AS o
WHERE o.id = p.organization_id
  AND jsonb_typeof(p.settings -> 'listingAuthorization') IS DISTINCT FROM 'object';

-- ---------------------------------------------------------------------------
-- Backfill parkings
-- ---------------------------------------------------------------------------

UPDATE public.parkings AS pk
SET settings = pk.settings || jsonb_build_object(
      'listingAuthorization',
      public.listing_authorization_from_org_leg(o.settings -> 'verification', 'parking')
    )
FROM public.organizations AS o
WHERE o.id = pk.organization_id
  AND jsonb_typeof(pk.settings -> 'listingAuthorization') IS DISTINCT FROM 'object';

DROP FUNCTION IF EXISTS public.listing_authorization_from_org_leg(JSONB, TEXT);
