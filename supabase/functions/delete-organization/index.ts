/**
 * delete-organization — DELETE an organization (owner only). Blocked when bookings exist.
 */

import { createServiceClient, verifyOrgOwner } from '../_shared/orgAuth.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { PROPERTY_MEDIA_BUCKET } from '../_shared/propertyMedia.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('delete-organization', async (req) => {
  requireHttpMethod(req, 'DELETE');
  const body = await readJsonBody(req);

  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  if (!orgId) {
    return jsonError(req, 'orgId is required');
  }

  const { user, org } = await verifyOrgOwner(req, orgId);
  const supabase = createServiceClient();

  const { data: properties, error: propertiesError } = await supabase
    .from('properties')
    .select('id, settings')
    .eq('organization_id', org.id);

  if (propertiesError) {
    console.error('[delete-organization] properties:', propertiesError.message);
    return jsonError(req, 'Could not verify organization properties', 500);
  }

  const propertyIds = (properties ?? []).map((row) => row.id as string);

  if (propertyIds.length > 0) {
    const { count: bookingCount, error: countError } = await supabase
      .from('guest_submissions')
      .select('id', { count: 'exact', head: true })
      .in('property_id', propertyIds);

    if (countError) {
      console.error('[delete-organization] booking count:', countError.message);
      return jsonError(req, 'Could not verify booking history', 500);
    }

    if ((bookingCount ?? 0) > 0) {
      return jsonError(
        req,
        'This organization has booking history and cannot be deleted. Remove or archive properties with bookings first.',
        409
      );
    }
  }

  for (const property of properties ?? []) {
    const settings =
      property.settings &&
      typeof property.settings === 'object' &&
      !Array.isArray(property.settings)
        ? (property.settings as Record<string, unknown>)
        : {};
    const media = Array.isArray(settings.media) ? settings.media : [];
    const storagePaths = media
      .filter(
        (entry): entry is { storagePath?: string } => typeof entry === 'object' && entry !== null
      )
      .map((entry) => (typeof entry.storagePath === 'string' ? entry.storagePath.trim() : ''))
      .filter((path) => path.startsWith(`${property.id}/`));

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(PROPERTY_MEDIA_BUCKET)
        .remove(storagePaths);
      if (storageError) {
        console.warn('[delete-organization] storage cleanup:', storageError.message);
      }
    }
  }

  const { error: deleteError } = await supabase.from('organizations').delete().eq('id', org.id);

  if (deleteError) {
    if (deleteError.code === '23503') {
      return jsonError(
        req,
        'Organization is still referenced by other records and cannot be deleted.',
        409
      );
    }
    console.error('[delete-organization]', deleteError.message);
    return jsonError(req, 'Failed to delete organization', 500);
  }

  await logActivity({
    action: 'org.deleted',
    organizationId: org.id,
    scope: 'org',
    actor: buildActorContext(
      'dashboard',
      { authUser: user, actorType: 'org_owner', role: 'owner' },
      req
    ),
    targetType: 'organization',
    targetId: org.id,
    targetLabel: org.name,
    metadata: { property_count: propertyIds.length },
  });

  return jsonSuccess(req, { deletedOrganizationId: org.id });
});
