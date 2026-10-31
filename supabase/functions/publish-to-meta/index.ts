/**
 * publish-to-meta — Publish marketing media to Facebook Page or Instagram.
 * GET — list publication history for the property.
 * POST — publish image/video; accepts https URLs or data URLs (uploaded to storage first).
 */

import { getPageAccessToken } from '../_shared/metaInboxGraph.ts';
import { resolvePublicMarketingMediaUrl } from '../_shared/marketingMediaUpload.ts';
import {
  isVideoUrl,
  mapPublishType,
  META_PUBLISH_TYPES as PUBLISH_TYPES,
  type MetaPublishType as PublishType,
} from '../_shared/marketingPublishAction.ts';
import { publishToFacebookPagePhoto, publishToInstagramMedia } from '../_shared/metaPublishing.ts';
import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, jsonUpgradeHook, readJsonBody } from '../_shared/httpResponse.ts';
import {
  PlanFeatureRequiredError,
  requireMarketingPublishAllowed,
} from '../_shared/planEntitlements.ts';
import {
  resolveOrganizationIdForProperty,
  resolveScopedPropertyAccess,
} from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import type { SocialChannelConnectionRow } from '../_shared/socialInboxTypes.ts';

type PublicationRow = {
  id: string;
  property_id: string;
  organization_id: string;
  connection_id: string;
  platform: string;
  publish_type: string;
  media_url: string;
  caption: string | null;
  meta_post_id: string | null;
  status: string;
  error_message: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
};

function resolvePublishType(input: {
  platform?: string;
  postType?: string;
  publishType?: string;
}): PublishType | null {
  if (input.publishType && PUBLISH_TYPES.has(input.publishType)) {
    return input.publishType as PublishType;
  }

  const platform = input.platform === 'instagram' ? 'instagram' : 'facebook';
  const postType = input.postType === 'story' ? 'story' : 'post';

  if (platform === 'facebook') {
    return postType === 'story' ? null : 'facebook_post';
  }
  return postType === 'story' ? 'instagram_story' : 'instagram_post';
}

function serializePublication(row: PublicationRow) {
  return {
    id: row.id,
    propertyId: row.property_id,
    organizationId: row.organization_id,
    connectionId: row.connection_id,
    platform: row.platform,
    publishType: row.publish_type,
    mediaUrl: row.media_url,
    caption: row.caption,
    metaPostId: row.meta_post_id,
    status: row.status,
    errorMessage: row.error_message,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

function isFutureSchedule(scheduledAt: string | null | undefined): boolean {
  if (!scheduledAt) return false;
  const ms = new Date(scheduledAt).getTime();
  return !Number.isNaN(ms) && ms > Date.now();
}

serveAuthenticated('publish-to-meta', async (req, user) => {
  const sb = createServiceClient();
  const url = new URL(req.url);
  let propertyId: string;
  let actorUserId: string | null = null;

  if (req.method === 'GET') {
    try {
      const scoped = await resolveScopedPropertyAccess(req, 'marketing:view');
      propertyId = scoped.property.id;
      await requirePropertyPermissionAndFeature(
        req,
        propertyId,
        'marketing:view',
        'marketingStudio'
      );
    } catch (err) {
      if (err instanceof Response) return err;
      throw err;
    }
  } else if (req.method === 'POST') {
    try {
      const scoped = await resolveScopedPropertyAccess(req, 'marketing.publish:add');
      propertyId = scoped.property.id;
      const access = await requirePropertyPermissionAndFeature(
        req,
        propertyId,
        'marketing.publish:add',
        'marketingPublishLimitPerGroup'
      );
      actorUserId = access.user.id;
      await requireMarketingPublishAllowed(propertyId);
    } catch (err) {
      if (err instanceof Response) return err;
      if (err instanceof PlanFeatureRequiredError) {
        return jsonUpgradeHook(req, err.message, { feature: err.feature });
      }
      throw err;
    }
  } else {
    return jsonError(req, 'Method not allowed', 405);
  }

  const organizationId = await resolveOrganizationIdForProperty(propertyId);

  if (req.method === 'GET') {
    const limitRaw = url.searchParams.get('limit');
    const limit = Math.min(Math.max(Number(limitRaw) || 30, 1), 100);

    const { data, error } = await sb
      .from('marketing_publications')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return jsonError(req, error.message, 500);

    const rows = (data ?? []) as PublicationRow[];
    return jsonSuccess(req, { publications: rows.map(serializePublication) });
  }

  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const body = await readJsonBody(req);

  const connectionId = typeof body.connectionId === 'string' ? body.connectionId.trim() : '';
  const publishType = resolvePublishType({
    platform: typeof body.platform === 'string' ? body.platform : undefined,
    postType: typeof body.postType === 'string' ? body.postType : undefined,
    publishType: typeof body.publishType === 'string' ? body.publishType : undefined,
  });
  const rawMediaUrl =
    (typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '') ||
    (typeof body.mediaUrl === 'string' ? body.mediaUrl.trim() : '');
  const caption = typeof body.caption === 'string' ? body.caption.trim() : '';
  const scheduledAt =
    typeof body.scheduledAt === 'string' && body.scheduledAt.trim()
      ? body.scheduledAt.trim()
      : null;
  const mediaType =
    typeof body.mediaType === 'string' && body.mediaType === 'video' ? 'video' : 'image';

  if (!connectionId || !publishType || !rawMediaUrl) {
    return jsonError(
      req,
      'connectionId, publishType (or platform+postType), and imageUrl/mediaUrl are required',
      400
    );
  }

  if (publishType === 'facebook_post' && mediaType === 'video') {
    return jsonError(req, 'Facebook video publishing is not supported in v1', 400);
  }

  let mediaUrl: string;
  try {
    mediaUrl = await resolvePublicMarketingMediaUrl(sb, propertyId, rawMediaUrl);
  } catch (error) {
    return jsonError(req, (error as Error).message, 400);
  }

  const { data: connRow, error: connError } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (connError) return jsonError(req, connError.message, 500);
  if (!connRow?.encrypted_access_token || !connRow.meta_page_id) {
    return jsonError(req, 'Channel not connected', 400);
  }

  const connection = connRow as SocialChannelConnectionRow;
  const { platform, dbPublishType } = mapPublishType(publishType);

  const publicationInsert = {
    property_id: propertyId,
    organization_id: organizationId,
    connection_id: connectionId,
    platform,
    publish_type: dbPublishType,
    media_url: mediaUrl,
    caption: caption || null,
    status: 'pending' as const,
    scheduled_at: scheduledAt,
    created_by: actorUserId,
  };

  const { data: publication, error: insertError } = await sb
    .from('marketing_publications')
    .insert(publicationInsert)
    .select('id')
    .single();

  if (insertError || !publication?.id) {
    return jsonError(req, insertError?.message ?? 'Failed to log publication', 500);
  }

  const publicationId = publication.id as string;

  const deferInstagramSchedule =
    publishType.startsWith('instagram_') && isFutureSchedule(scheduledAt);

  if (deferInstagramSchedule) {
    return jsonSuccess(req, {
      publicationId,
      status: 'pending',
      scheduledAt,
      message: 'Instagram scheduling is stored; publish when due via a follow-up call',
    });
  }

  try {
    const pageAccessToken = await getPageAccessToken(connection);
    let metaPostId: string | null = null;
    const now = new Date().toISOString();
    const isVideo = mediaType === 'video' || isVideoUrl(mediaUrl);

    if (publishType === 'facebook_post') {
      const result = await publishToFacebookPagePhoto({
        pageId: connection.meta_page_id!,
        pageAccessToken,
        imageUrl: mediaUrl,
        caption,
        scheduledAt,
      });
      metaPostId = result.postId ?? result.photoId;
    } else {
      if (!connection.meta_ig_user_id) {
        throw new Error('Instagram account not linked to this Facebook Page');
      }

      let igMediaType: 'IMAGE' | 'STORIES' | 'REELS' = 'IMAGE';
      if (publishType === 'instagram_story') igMediaType = 'STORIES';
      if (publishType === 'instagram_reel') igMediaType = 'REELS';

      const result = await publishToInstagramMedia({
        igUserId: connection.meta_ig_user_id,
        pageAccessToken,
        imageUrl: isVideo ? undefined : mediaUrl,
        videoUrl: isVideo ? mediaUrl : undefined,
        caption,
        mediaType: igMediaType,
      });
      metaPostId = result.mediaId;
    }

    const isScheduled = publishType === 'facebook_post' && isFutureSchedule(scheduledAt);
    const status = isScheduled ? 'pending' : 'published';

    await sb
      .from('marketing_publications')
      .update({
        meta_post_id: metaPostId,
        status,
        published_at: isScheduled ? null : now,
        error_message: null,
      })
      .eq('id', publicationId);

    await logAssetActivity({
      req,
      user,
      action: 'marketing.published_to_meta',
      propertyId,
      organizationId,
      targetType: 'marketing_post',
      targetId: publicationId,
      metadata: {
        target: publishType,
        status,
        scheduled: isScheduled,
        meta_post_id: metaPostId,
      },
    });

    return jsonSuccess(req, {
      publicationId,
      metaPostId,
      postId: metaPostId,
      status,
      publishedAt: isScheduled ? null : now,
      scheduledAt: isScheduled ? scheduledAt : null,
    });
  } catch (error) {
    const message = (error as Error).message;
    await sb
      .from('marketing_publications')
      .update({
        status: 'failed',
        error_message: message,
      })
      .eq('id', publicationId);

    return jsonError(req, message, 502);
  }
});
