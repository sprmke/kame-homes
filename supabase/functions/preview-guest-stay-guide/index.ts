/**
 * preview-guest-stay-guide — Admin GET for stay guide preview with sample booking data.
 *
 * GET ?property_id=…&property=<slug> (optional slug guard)
 * Auth: publicPages:view
 * Plan: Free/Starter without `publicPagesAutosave` → { planAccessDenied: true }
 * (Public Pages Open / iframe preview). Page Editor uses PreviewOverrideProvider.
 */

import { loadGuestStayGuidePreview } from '../_shared/guestStayGuide.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { isFeatureEnabled } from '../_shared/planFeatures.ts';
import { resolvePropertyEntitlements } from '../_shared/planEntitlements.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('preview-guest-stay-guide', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }

  const { property } = await resolveScopedPropertyAccess(req, 'publicPages:view');
  const url = new URL(req.url);
  const propertySlug = (url.searchParams.get('property') ?? '').trim() || property.slug;

  const entitlements = await resolvePropertyEntitlements(property.id);
  if (!isFeatureEnabled(entitlements, 'publicPagesAutosave')) {
    return jsonSuccess(req, { planAccessDenied: true, isPreview: true });
  }

  const data = await loadGuestStayGuidePreview(property.id, propertySlug);
  if (!data) {
    return jsonError(req, 'Stay guide preview is not available for this property', 404);
  }

  return jsonSuccess(req, { ...data, isPreview: true });
});
