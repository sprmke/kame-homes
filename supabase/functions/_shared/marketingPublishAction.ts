/**
 * Shared "publish to Meta" action — single source of truth for `publish-to-meta` and the AI
 * dashboard assistant's `propose_publish_to_meta` tool. This is the single highest-blast-radius
 * tool in the assistant's catalog: it posts to a real, public Facebook Page or Instagram account,
 * irreversibly, using whatever https media URL it's given (the underlying resolver accepts any
 * https URL unchanged — that's an existing product decision in `marketingMediaUpload.ts`, not
 * something this module tightens). The only safety mechanism here is the mandatory Tier-2 +
 * external_send host confirmation showing the exact caption/media/destination before it fires.
 */

import { getPageAccessToken } from './metaInboxGraph.ts';
import { resolvePublicMarketingMediaUrl } from './marketingMediaUpload.ts';
import { publishToFacebookPagePhoto, publishToInstagramMedia } from './metaPublishing.ts';
import { createServiceClient } from './orgAuth.ts';
import type { SocialChannelConnectionRow } from './socialInboxTypes.ts';

export type MetaPublishType =
  'facebook_post' | 'instagram_post' | 'instagram_story' | 'instagram_reel';

export const META_PUBLISH_TYPES = new Set<string>([
  'facebook_post',
  'instagram_post',
  'instagram_story',
  'instagram_reel',
]);

export class MarketingPublishError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Exported so `publish-to-meta`'s edge function can share this instead of keeping its own copy. */
export function mapPublishType(publishType: MetaPublishType): {
  platform: string;
  dbPublishType: 'post' | 'story' | 'reel';
} {
  if (publishType === 'facebook_post') return { platform: 'facebook', dbPublishType: 'post' };
  if (publishType === 'instagram_story') return { platform: 'instagram', dbPublishType: 'story' };
  if (publishType === 'instagram_reel') return { platform: 'instagram', dbPublishType: 'reel' };
  return { platform: 'instagram', dbPublishType: 'post' };
}

/** Exported so `publish-to-meta`'s edge function can share this instead of keeping its own copy. */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('video/');
}

export async function publishMarketingPost(input: {
  propertyId: string;
  organizationId: string;
  connectionId: string;
  publishType: MetaPublishType;
  rawMediaUrl: string;
  caption: string;
  createdBy: string;
}): Promise<{
  publicationId: string;
  metaPostId: string | null;
  status: string;
  publishedAt: string | null;
}> {
  const sb = createServiceClient();

  if (input.publishType === 'facebook_post' && isVideoUrl(input.rawMediaUrl)) {
    throw new MarketingPublishError('Facebook video publishing is not supported in v1');
  }

  const mediaUrl = await resolvePublicMarketingMediaUrl(sb, input.propertyId, input.rawMediaUrl);

  const { data: connRow, error: connError } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('id', input.connectionId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();
  if (connError) throw new MarketingPublishError(connError.message, 500);
  if (!connRow?.encrypted_access_token || !connRow.meta_page_id) {
    throw new MarketingPublishError('Channel not connected');
  }
  const connection = connRow as SocialChannelConnectionRow;
  const { platform, dbPublishType } = mapPublishType(input.publishType);

  const { data: publication, error: insertError } = await sb
    .from('marketing_publications')
    .insert({
      property_id: input.propertyId,
      organization_id: input.organizationId,
      connection_id: input.connectionId,
      platform,
      publish_type: dbPublishType,
      media_url: mediaUrl,
      caption: input.caption || null,
      status: 'pending',
      scheduled_at: null,
      created_by: input.createdBy,
    })
    .select('id')
    .single();
  if (insertError || !publication?.id) {
    throw new MarketingPublishError(insertError?.message ?? 'Failed to log publication', 500);
  }
  const publicationId = publication.id as string;

  try {
    const pageAccessToken = await getPageAccessToken(connection);
    let metaPostId: string | null = null;
    const now = new Date().toISOString();
    const isVideo = isVideoUrl(mediaUrl);

    if (input.publishType === 'facebook_post') {
      const result = await publishToFacebookPagePhoto({
        pageId: connection.meta_page_id!,
        pageAccessToken,
        imageUrl: mediaUrl,
        caption: input.caption,
      });
      metaPostId = result.postId ?? result.photoId;
    } else {
      if (!connection.meta_ig_user_id) {
        throw new Error('Instagram account not linked to this Facebook Page');
      }
      let igMediaType: 'IMAGE' | 'STORIES' | 'REELS' = 'IMAGE';
      if (input.publishType === 'instagram_story') igMediaType = 'STORIES';
      if (input.publishType === 'instagram_reel') igMediaType = 'REELS';

      const result = await publishToInstagramMedia({
        igUserId: connection.meta_ig_user_id,
        pageAccessToken,
        imageUrl: isVideo ? undefined : mediaUrl,
        videoUrl: isVideo ? mediaUrl : undefined,
        caption: input.caption,
        mediaType: igMediaType,
      });
      metaPostId = result.mediaId;
    }

    await sb
      .from('marketing_publications')
      .update({
        meta_post_id: metaPostId,
        status: 'published',
        published_at: now,
        error_message: null,
      })
      .eq('id', publicationId);

    return { publicationId, metaPostId, status: 'published', publishedAt: now };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publish failed';
    await sb
      .from('marketing_publications')
      .update({ status: 'failed', error_message: message })
      .eq('id', publicationId);
    throw new MarketingPublishError(message, 502);
  }
}
