/**
 * delete-property — DELETE a property (owner only). Blocked when bookings exist.
 */

import { createServiceClient, verifyPropertyOwner } from '../_shared/orgAuth.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { PROPERTY_MEDIA_BUCKET } from '../_shared/propertyMedia.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('delete-property', async (req) => {
  requireHttpMethod(req, 'DELETE');
  const body = await readJsonBody(req);

  const propertyId = typeof body.propertyId === 'string' ? body.propertyId.trim() : '';
  if (!propertyId) {
    return jsonError(req, 'propertyId is required');
  }

  const { user, property, org } = await verifyPropertyOwner(req, propertyId);
  const supabase = createServiceClient();

  const { count: bookingCount, error: countError } = await supabase
    .from('guest_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', property.id);

  if (countError) {
    console.error('[delete-property] booking count:', countError.message);
    return jsonError(req, 'Could not verify booking history', 500);
  }

  if ((bookingCount ?? 0) > 0) {
    return jsonError(
      req,
      'This property has booking history and cannot be deleted. Archive it instead to hide it from active use.',
      409
    );
  }

  const settings =
    property.settings && typeof property.settings === 'object' && !Array.isArray(property.settings)
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
      console.warn('[delete-property] storage cleanup:', storageError.message);
    }
  }

  const { error: deleteError } = await supabase.from('properties').delete().eq('id', property.id);

  if (deleteError) {
    if (deleteError.code === '23503') {
      return jsonError(
        req,
        'Property is still referenced by other records and cannot be deleted. Archive it instead.',
        409
      );
    }
    console.error('[delete-property]', deleteError.message);
    return jsonError(req, 'Failed to delete property', 500);
  }

  await logActivity({
    action: 'property.deleted',
    organizationId: org.id,
    propertyId: property.id,
    scope: 'property',
    actor: buildActorContext(
      'dashboard',
      { authUser: user, actorType: 'org_owner', role: 'owner' },
      req
    ),
    targetType: 'property',
    targetId: property.id,
    targetLabel: property.name,
  });

  return jsonSuccess(req, { deletedPropertyId: property.id });
});
