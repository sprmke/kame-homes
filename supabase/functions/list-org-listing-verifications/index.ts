/**
 * list-org-listing-verifications — Rollup of every listing's verification state for one org.
 * Powers the listing panel in the host Get Verified modal and the super admin queue.
 * Auth: super admin OR org owner.
 */

import { createServiceClient, verifyOrgOwner, type OrgRow } from '../_shared/orgAuth.ts';
import {
  missingListingDocs,
  resolveListingAuthorization,
  type ListingKind,
} from '../_shared/listingAuthorization.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

type ListingRollupRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  settings: Record<string, unknown> | null;
};

async function loadOrg(orgId: string): Promise<OrgRow> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle();

  if (error) {
    console.error('[list-org-listing-verifications]', error.message);
    throw new Error('Failed to load organization');
  }
  if (!data) {
    throw new Response(JSON.stringify({ success: false, error: 'Organization not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return data as OrgRow;
}

async function authorize(req: Request, orgId: string): Promise<OrgRow> {
  try {
    await verifySuperAdminJwt(req);
    return await loadOrg(orgId);
  } catch (error) {
    if (error instanceof Response && error.status === 403) {
      return (await verifyOrgOwner(req, orgId)).org;
    }
    throw error;
  }
}

serveAuthenticated('list-org-listing-verifications', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId')?.trim() ?? '';
  if (!orgId) return jsonError(req, 'orgId is required');

  const org = await authorize(req, orgId);
  const supabase = createServiceClient();

  const [properties, parkings] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name, slug, status, settings')
      .eq('organization_id', orgId)
      .order('name', { ascending: true }),
    supabase
      .from('parkings')
      .select('id, name, slug, status, settings')
      .eq('organization_id', orgId)
      .order('name', { ascending: true }),
  ]);

  if (properties.error || parkings.error) {
    console.error(
      '[list-org-listing-verifications]',
      properties.error?.message ?? parkings.error?.message
    );
    return jsonError(req, 'Failed to load listings', 500);
  }

  const toRollup = (rows: ListingRollupRow[] | null, listingKind: ListingKind) =>
    (rows ?? []).map((row) => {
      const authorization = resolveListingAuthorization(row.settings, org.settings, listingKind);
      return {
        listingKind,
        listingId: row.id,
        name: row.name,
        slug: row.slug,
        listingStatus: row.status,
        relationship: authorization.relationship,
        contractEndDate: authorization.contractEndDate,
        baseStatus: authorization.baseStatus,
        recommendedStatus: authorization.recommendedStatus,
        baseRejectionKind: authorization.baseRejectionKind,
        recommendedRejectionKind: authorization.recommendedRejectionKind,
        recommendedBadge: authorization.recommendedStatus === 'approved',
        hasProof: Boolean(authorization.assets.proofPath),
        missingDocs: missingListingDocs(authorization),
      };
    });

  const listings = [
    ...toRollup(properties.data as ListingRollupRow[] | null, 'property'),
    ...toRollup(parkings.data as ListingRollupRow[] | null, 'parking'),
  ];

  return jsonSuccess(req, {
    organization: { id: org.id, name: org.name, slug: org.slug },
    listings,
  });
});
