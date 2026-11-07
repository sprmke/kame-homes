/**
 * delete-property — DELETE a property (owner only).
 *
 * Deleting is only for empty listings. Every blocking table is named in the 409 so the host
 * knows what to clean up, and the confirmation must repeat the property name. What cascades
 * (inbox threads, reviews, payment history, team access, marketing records) is spelled out in
 * the client sheet and the email sent to removed team members.
 *
 * Plan: docs/workflow/in-progress/property-archive-and-delete-lifecycle.md (P6).
 */

import { createServiceClient, verifyPropertyOwner } from '../_shared/orgAuth.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { loadAuthUserProfile } from '../_shared/authUserProfile.ts';
import { renderBrandedEmailShell } from '../_shared/brandedEmailShell.ts';
import {
  jsonError,
  jsonResponse,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { readListingAuthorizationFromSettings } from '../_shared/listingAuthorization.ts';
import { PROPERTY_MEDIA_BUCKET } from '../_shared/propertyMedia.ts';
import {
  getPropertyLifecycleImpact,
  PropertyLifecycleError,
} from '../_shared/propertyLifecycle.ts';
import { sendResendEmail } from '../_shared/sendResendEmail.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const MARKETING_MEDIA_BUCKET = 'marketing-media';
const LISTING_AUTHORIZATION_BUCKET = 'listing-authorization-assets';
const APP_SETTINGS_ASSETS_BUCKET = 'app-settings-assets';
const GUEST_CHAT_ATTACHMENTS_BUCKET = 'guest-chat-attachments';

/** Property-scoped prefixes inside `app-settings-assets` (see appSettingsAssetUpload.ts). */
const APP_SETTINGS_PROPERTY_PREFIXES = [
  'gaf-unit-owner-signature',
  'external-review',
  'external-review-stay',
];

type StorageRemoval = {
  bucket: string;
  prefix: string;
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function buildBlockerMessage(
  impact: Awaited<ReturnType<typeof getPropertyLifecycleImpact>>
): string {
  const parts: string[] = [];
  if (impact.deleteBlockers.bookings > 0) {
    parts.push(plural(impact.deleteBlockers.bookings, 'booking', 'bookings'));
  }
  if (impact.deleteBlockers.finance > 0) {
    parts.push(plural(impact.deleteBlockers.finance, 'finance entry', 'finance entries'));
  }
  if (impact.deleteBlockers.maintenance > 0) {
    parts.push(plural(impact.deleteBlockers.maintenance, 'maintenance item', 'maintenance items'));
  }
  if (impact.deleteBlockers.importBatches > 0) {
    parts.push(plural(impact.deleteBlockers.importBatches, 'import batch', 'import batches'));
  }
  return `This property still has ${parts.join(', ')}. Archive it instead, or remove those records first.`;
}

/** Recursively remove every object under a storage prefix. Best effort, never throws. */
async function removeStoragePrefix(
  supabase: ReturnType<typeof createServiceClient>,
  bucket: string,
  prefix: string
): Promise<void> {
  const directory = prefix.replace(/\/+$/, '');
  const pending = [directory];
  while (pending.length > 0) {
    const dir = pending.pop()!;
    const { data, error } = await supabase.storage.from(bucket).list(dir, { limit: 1000 });
    if (error) {
      console.warn(`[delete-property] list ${bucket}/${dir}:`, error.message);
      continue;
    }

    const files: string[] = [];
    for (const item of data ?? []) {
      const path = `${dir}/${item.name}`;
      // Supabase lists folders with a null id and no metadata.
      if (item.id === null || item.id === undefined) pending.push(path);
      else files.push(path);
    }

    if (files.length > 0) {
      const { error: removeError } = await supabase.storage.from(bucket).remove(files);
      if (removeError) {
        console.warn(`[delete-property] remove ${bucket}/${dir}:`, removeError.message);
      }
    }
  }
}

async function notifyRemovedMembers(input: {
  supabase: ReturnType<typeof createServiceClient>;
  memberUserIds: string[];
  propertyName: string;
  organizationName: string;
}): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  if (!resendKey || !fromEmail) return;

  for (const userId of input.memberUserIds) {
    try {
      const profile = await loadAuthUserProfile(input.supabase, userId);
      if (!profile.email?.trim()) continue;

      const html = await renderBrandedEmailShell({
        brandName: input.organizationName,
        unitLabel: input.propertyName,
        emailTitle: 'Property deleted',
        bodyHtml: `<p>Hi ${profile.name || 'there'},</p><p>${input.propertyName} was deleted by the organization owner. You no longer have access to this property or its records.</p>`,
        brandColor: null,
      });

      await sendResendEmail({
        from: fromEmail,
        to: [profile.email],
        subject: `${input.propertyName} was deleted`,
        html,
        errorLabel: 'property-deleted',
      });
    } catch (error) {
      console.warn(
        '[delete-property] member email failed:',
        error instanceof Error ? error.message : error
      );
    }
  }
}

serveAuthenticated('delete-property', async (req) => {
  requireHttpMethod(req, 'DELETE');
  const body = await readJsonBody(req);

  const propertyId = typeof body.propertyId === 'string' ? body.propertyId.trim() : '';
  if (!propertyId) {
    return jsonError(req, 'propertyId is required');
  }

  const { user, property, org } = await verifyPropertyOwner(req, propertyId);
  const supabase = createServiceClient();

  const confirmName = typeof body.confirmName === 'string' ? body.confirmName.trim() : '';
  if (confirmName !== property.name.trim()) {
    return jsonError(req, 'Type the property name to confirm deletion', 400);
  }

  // A listing still in verification review would leave orphaned review rows behind.
  const listingAuthorization = readListingAuthorizationFromSettings(property.settings);
  if (listingAuthorization.baseStatus === 'pending') {
    return jsonError(
      req,
      'This listing is still in review. Wait for the review to finish before deleting it.',
      409
    );
  }

  let impact: Awaited<ReturnType<typeof getPropertyLifecycleImpact>>;
  try {
    impact = await getPropertyLifecycleImpact(propertyId);
  } catch (error) {
    if (error instanceof PropertyLifecycleError) {
      return jsonError(req, error.message, error.status);
    }
    throw error;
  }

  if (impact.deleteBlockers.total > 0) {
    return jsonResponse(
      req,
      {
        success: false,
        error: buildBlockerMessage(impact),
        code: 'DELETE_BLOCKED',
        details: impact.deleteBlockers,
      },
      409,
      'private'
    );
  }

  // Collect what lives outside the property row before the cascade removes the link.
  const [memberRows, conversationRows] = await Promise.all([
    supabase.from('property_members').select('user_id').eq('property_id', propertyId).limit(1000),
    supabase.from('social_conversations').select('id').eq('property_id', propertyId).limit(5000),
  ]);

  const memberUserIds = (memberRows.data ?? []).map((row) => row.user_id as string).filter(Boolean);
  const conversationIds = (conversationRows.data ?? []).map((row) => row.id as string);

  // Drop the subscription slot first so the billing event lands even if the delete fails.
  try {
    const { removePropertyFromOrgSubscription } = await import('../_shared/planEntitlements.ts');
    await removePropertyFromOrgSubscription(propertyId, user.id);
  } catch (error) {
    console.warn(
      '[delete-property] subscription unslot failed:',
      error instanceof Error ? error.message : error
    );
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

  const settings =
    property.settings && typeof property.settings === 'object' && !Array.isArray(property.settings)
      ? (property.settings as Record<string, unknown>)
      : {};
  const media = Array.isArray(settings.media) ? settings.media : [];
  const mediaPaths = media
    .filter(
      (entry): entry is { storagePath?: string } => typeof entry === 'object' && entry !== null
    )
    .map((entry) => (typeof entry.storagePath === 'string' ? entry.storagePath.trim() : ''))
    .filter((path) => path.startsWith(`${property.id}/`));

  const removals: StorageRemoval[] = [
    { bucket: PROPERTY_MEDIA_BUCKET, prefix: `${property.id}/` },
    { bucket: MARKETING_MEDIA_BUCKET, prefix: `${property.id}/` },
    {
      bucket: LISTING_AUTHORIZATION_BUCKET,
      prefix: `org/${org.id}/property/${property.id}/`,
    },
    ...APP_SETTINGS_PROPERTY_PREFIXES.map((prefix) => ({
      bucket: APP_SETTINGS_ASSETS_BUCKET,
      prefix: `${prefix}/${property.id}/`,
    })),
    ...conversationIds.map((conversationId) => ({
      bucket: GUEST_CHAT_ATTACHMENTS_BUCKET,
      prefix: `${org.id}/${conversationId}/`,
    })),
  ];

  // Property-gallery objects are the only ones we can name without a recursive list.
  if (mediaPaths.length > 0) {
    const { error: mediaError } = await supabase.storage
      .from(PROPERTY_MEDIA_BUCKET)
      .remove(mediaPaths);
    if (mediaError) {
      console.warn('[delete-property] media cleanup:', mediaError.message);
    }
  }

  for (const { bucket, prefix } of removals) {
    await removeStoragePrefix(supabase, bucket, prefix);
  }

  await notifyRemovedMembers({
    supabase,
    memberUserIds,
    propertyName: property.name,
    organizationName: org.name,
  });

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
    metadata: {
      removed_members: memberUserIds.length,
      inbox_threads: impact.cascade.inboxThreads,
      reviews: impact.cascade.reviews,
      payment_transactions: impact.cascade.paymentTransactions,
      marketing_records: impact.cascade.marketingRecords,
      was_archived: impact.state === 'archived',
    },
  });

  return jsonSuccess(req, { deletedPropertyId: property.id });
});
