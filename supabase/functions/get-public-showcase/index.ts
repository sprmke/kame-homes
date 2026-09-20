/**
 * get-public-showcase — Public GET for property showcase landing page.
 * Trigger: guest SPA `/properties/:propertySlug/showcase`. Auth: anon (verify_jwt = false).
 * Query: ?property=<slug> or ?property_id=<uuid>
 * Without `propertyShowcase` entitlement → 200 with { planAccessDenied: true }
 * (including preview/embed — host dashboard iframes and Open links must show the lock).
 * Page Editor live canvas uses PreviewOverrideProvider and never hits this endpoint.
 * Unpublished → 200 with { published: false } and no property payload (no data leak).
 * `?preview=1`/`?embed=1` additionally require `?admin_jwt=<host session JWT>` proving
 * property access (see hasPreviewAccess below) — without it they're ignored and the
 * request falls through to the same unpublished-safe response an anonymous guest gets.
 */

import {
  getCustomPageTemplateOrDefault,
  SHOWCASE_DEFAULT_TEMPLATE_KEY,
} from '../_shared/customPages.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import {
  getPublicPageConfigOrDefault,
  type PropertyShowcaseConfig,
} from '../_shared/publicPageConfigs.ts';
import { resolveAppSettings } from '../_shared/appSettings.ts';
import { loadGuestFacingContactInfo } from '../_shared/guestContactInfo.ts';
import { verifyPropertyAccess } from '../_shared/orgAuth.ts';
import { isFeatureEnabled } from '../_shared/planFeatures.ts';
import { resolvePropertyEntitlements } from '../_shared/planEntitlements.ts';
import {
  loadPublicPropertyById,
  loadPublicPropertyBySlug,
} from '../_shared/publicPropertyService.ts';
import { readPropertyIdFromUrl, readPropertySlugFromUrl } from '../_shared/propertyScope.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

/**
 * `?preview=1`/`?embed=1` reveal an unpublished draft (Lorem ipsum, stock photos,
 * host contact info) — never honor them without proof the caller has host access to
 * THIS property. The host dashboard passes its own Supabase session JWT via
 * `?admin_jwt=` (query, since this is a GET and the `Authorization` header is
 * reserved for the anon gateway key on this public route); we re-verify it through
 * the same `verifyPropertyAccess` path every admin endpoint uses, scoped to this
 * property's id, so a stolen/guessed preview URL alone grants nothing.
 */
async function hasPreviewAccess(req: Request, propertyId: string): Promise<boolean> {
  const adminJwt = new URL(req.url).searchParams.get('admin_jwt');
  if (!adminJwt) return false;
  // `Headers` iteration always yields lowercase keys, so spreading it into a plain
  // object then adding `Authorization` (capitalized) leaves both the original
  // lowercase `authorization` (anon gateway key) and this override as distinct
  // object keys — `new Headers(...)` then joins same-name headers with a comma,
  // corrupting the Bearer token. Build the Headers object directly and `set`
  // instead, which correctly replaces the header case-insensitively.
  const proxyHeaders = new Headers(req.headers);
  proxyHeaders.set('Authorization', `Bearer ${adminJwt}`);
  const proxyReq = new Request(req.url, { headers: proxyHeaders });
  try {
    await verifyPropertyAccess(proxyReq, propertyId);
    return true;
  } catch {
    return false;
  }
}

servePublic('get-public-showcase', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }

  const limited = await publicGetRateLimitGate(req, 'get-public-showcase');
  if (limited) return limited;

  const url = new URL(req.url);
  const propertyIdParam = readPropertyIdFromUrl(url);
  const slug = readPropertySlugFromUrl(url);
  const previewRequested =
    url.searchParams.get('preview') === '1' || url.searchParams.get('embed') === '1';

  if (!propertyIdParam && !slug) {
    return jsonError(req, 'property or property_id query param is required', 400);
  }

  const detail = propertyIdParam
    ? await loadPublicPropertyById(propertyIdParam)
    : await loadPublicPropertyBySlug(slug!);

  if (!detail) {
    return jsonError(req, 'Property not found', 404);
  }

  const propertyId = detail.id;
  const preview = previewRequested && (await hasPreviewAccess(req, propertyId));
  const entitlements = await resolvePropertyEntitlements(propertyId);
  if (!isFeatureEnabled(entitlements, 'propertyShowcase')) {
    // Locked-plan response — not worth caching publicly (rare path, and plan
    // state can change at any time); stays at the safe default.
    return jsonSuccess(req, {
      planAccessDenied: true,
      published: false,
      templateKey: SHOWCASE_DEFAULT_TEMPLATE_KEY,
      config: { version: 1, published: false },
    });
  }

  const config = (await getPublicPageConfigOrDefault(
    propertyId,
    'property_showcase'
  )) as PropertyShowcaseConfig;
  const templateKey = await getCustomPageTemplateOrDefault(propertyId, 'property_showcase');
  const appSettings = await resolveAppSettings(propertyId);
  const guestContact = await loadGuestFacingContactInfo(propertyId, appSettings);

  if (!config.published && !preview) {
    return jsonSuccess(req, {
      published: false,
      templateKey: SHOWCASE_DEFAULT_TEMPLATE_KEY,
      config: { version: 1, published: false },
    });
  }

  // `?preview=1`/`?embed=1` renders host-dashboard-only state (may include an
  // unpublished draft) — never let that variant land in a shared cache, even
  // though it's a distinct URL. The public, published showcase is publicDynamic.
  return jsonSuccess(
    req,
    {
      published: config.published,
      templateKey,
      config,
      property: detail,
      guestContact: {
        contactName: guestContact.contactName,
        contactPhone: guestContact.contactPhone,
        contactEmail: guestContact.contactEmail,
        facebookUrl: guestContact.facebookPageUrl,
        airbnbUrl: guestContact.airbnbUrl,
        instagramUrl: appSettings.instagramUrl || null,
        tiktokUrl: appSettings.tiktokUrl || null,
      },
    },
    undefined,
    preview ? 'private' : 'publicDynamic'
  );
});
