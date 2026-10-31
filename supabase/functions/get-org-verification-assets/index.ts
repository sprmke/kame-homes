/**
 * get-org-verification-assets — GET signed preview URLs for a submitted org's verification docs.
 * Auth: super admin OR org owner (platform admin). Signed URLs are only returned at upload time
 * otherwise, so review and the host Get Verified modal re-sign stored paths.
 */

import {
  createServiceClient,
  serializeOrganization,
  verifyOrgOwner,
  type OrgRow,
} from '../_shared/orgAuth.ts';
import {
  ORG_VERIFICATION_BUCKET,
  readOrgVerificationFromSettings,
} from '../_shared/orgVerification.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';
import { formatPublicUrl } from '../_shared/utils.ts';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function signPath(
  supabase: ReturnType<typeof createServiceClient>,
  path: string | null
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(ORG_VERIFICATION_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error('[get-org-verification-assets] signed url', error.message);
    return null;
  }
  if (!data?.signedUrl) return null;
  // Kong-internal hosts only — do NOT rewrite to PUBLIC_API_URL/ngrok (breaks <img>/<iframe>).
  return formatPublicUrl(data.signedUrl);
}

async function loadOrganization(orgId: string): Promise<OrgRow> {
  const supabase = createServiceClient();
  const { data: orgRow, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle();

  if (error) {
    console.error('[get-org-verification-assets]', error.message);
    throw new Error('Failed to load organization');
  }
  if (!orgRow) {
    throw new Response(JSON.stringify({ success: false, error: 'Organization not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return orgRow as OrgRow;
}

async function authorizeVerificationAssets(req: Request, orgId: string): Promise<OrgRow> {
  try {
    await verifySuperAdminJwt(req);
    return await loadOrganization(orgId);
  } catch (error) {
    if (error instanceof Response && error.status === 403) {
      return (await verifyOrgOwner(req, orgId)).org;
    }
    throw error;
  }
}

serveAuthenticated('get-org-verification-assets', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId')?.trim() ?? '';
  if (!orgId) return jsonError(req, 'orgId is required');

  const org = await authorizeVerificationAssets(req, orgId);
  const supabase = createServiceClient();
  const verification = readOrgVerificationFromSettings(org.settings);

  const [
    validIdUrl,
    socialProofUrl,
    selfieWithIdUrl,
    platformAdminProofUrl,
    legitimacyCheckProofUrl,
    businessPermitOrBirUrl,
    propertyOwnershipProofUrl,
    parkingSocialProofUrl,
    ownershipProofUrl,
    azurePmoConfirmationUrl,
  ] = await Promise.all([
    signPath(supabase, verification.assets.validIdPath),
    signPath(supabase, verification.assets.socialProofPath),
    signPath(supabase, verification.assets.selfieWithIdPath),
    signPath(supabase, verification.assets.platformAdminProofPath),
    signPath(supabase, verification.assets.legitimacyCheckProofPath),
    signPath(supabase, verification.assets.businessPermitOrBirPath),
    signPath(supabase, verification.assets.propertyOwnershipProofPath),
    signPath(supabase, verification.assets.parkingSocialProofPath),
    signPath(supabase, verification.assets.ownershipProofPath),
    signPath(supabase, verification.assets.azurePmoConfirmationPath),
  ]);
  const legacyPmoUrls =
    verification.assets.pmoEmailPaths.length > 0
      ? await Promise.all(verification.assets.pmoEmailPaths.map((path) => signPath(supabase, path)))
      : [];

  return jsonSuccess(req, {
    organization: serializeOrganization(org),
    verification,
    assetUrls: {
      validIdUrl,
      socialProofUrl,
      selfieWithIdUrl,
      platformAdminProofUrl,
      legitimacyCheckProofUrl,
      businessPermitOrBirUrl,
      /** @deprecated listing-scoped — see get-listing-authorization-assets */
      propertyOwnershipProofUrl,
      /** @deprecated listing-scoped — see get-listing-authorization-assets */
      parkingSocialProofUrl,
      /** @deprecated listing-scoped — see get-listing-authorization-assets */
      ownershipProofUrl,
      /** @deprecated listing-scoped — see get-listing-authorization-assets */
      azurePmoConfirmationUrl,
      /** @deprecated use azurePmoConfirmationUrl */
      opsProofUrl: azurePmoConfirmationUrl,
      pmoEmailUrls: azurePmoConfirmationUrl ? [azurePmoConfirmationUrl] : legacyPmoUrls,
    },
  });
});
