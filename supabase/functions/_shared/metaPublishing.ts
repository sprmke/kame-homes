/**
 * Meta Graph API helpers for Marketing Content Studio publishing.
 */

import { META_GRAPH_BASE } from './metaInboxConfig.ts';
import { parseMetaGraphJson } from './metaInboxGraph.ts';

export type FacebookPhotoPublishResult = {
  photoId: string;
  postId: string | null;
};

export type InstagramMediaPublishResult = {
  mediaId: string;
};

function metaApiError(json: Record<string, unknown>, fallback: string): string {
  const err = json.error as { message?: string } | undefined;
  return err?.message ?? fallback;
}

/**
 * Publish a photo to a Facebook Page feed.
 * FB: POST /{page-id}/photos with url + message.
 */
export async function publishToFacebookPagePhoto(input: {
  pageId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption?: string;
  scheduledAt?: string | null;
}): Promise<FacebookPhotoPublishResult> {
  const url = new URL(`${META_GRAPH_BASE}/${input.pageId}/photos`);
  url.searchParams.set('url', input.imageUrl);
  url.searchParams.set('access_token', input.pageAccessToken);

  if (input.caption?.trim()) {
    url.searchParams.set('message', input.caption.trim());
  }

  if (input.scheduledAt) {
    const scheduledMs = new Date(input.scheduledAt).getTime();
    if (!Number.isNaN(scheduledMs) && scheduledMs > Date.now()) {
      url.searchParams.set('published', 'false');
      url.searchParams.set('scheduled_publish_time', String(Math.floor(scheduledMs / 1000)));
    }
  }

  const res = await fetch(url.toString(), { method: 'POST' });
  const json = await parseMetaGraphJson(res);
  if (!res.ok || !json.id) {
    throw new Error(metaApiError(json, 'Facebook photo publish failed'));
  }

  return {
    photoId: String(json.id),
    postId: json.post_id ? String(json.post_id) : null,
  };
}

/**
 * Meta processes an IG video container asynchronously — calling media_publish
 * immediately after container creation intermittently fails with a
 * `media ... unavailable`-style Graph API error for anything but the
 * smallest clips, since the container isn't done transcoding yet. Poll
 * status_code until FINISHED (or ERROR/timeout) before publishing.
 */
async function waitForInstagramContainerReady(
  creationId: string,
  pageAccessToken: string
): Promise<void> {
  const maxAttempts = 20;
  const intervalMs = 3000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusUrl = new URL(`${META_GRAPH_BASE}/${creationId}`);
    statusUrl.searchParams.set('fields', 'status_code');
    statusUrl.searchParams.set('access_token', pageAccessToken);

    const res = await fetch(statusUrl.toString());
    const json = await parseMetaGraphJson(res);
    const statusCode = typeof json.status_code === 'string' ? json.status_code : null;

    if (statusCode === 'FINISHED') return;
    if (statusCode === 'ERROR') {
      throw new Error(metaApiError(json, 'Instagram media processing failed'));
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error('Instagram media is still processing — try publishing again in a moment');
}

/**
 * Publish image media to Instagram (feed post or story).
 * IG: container creation + media_publish.
 */
export async function publishToInstagramMedia(input: {
  igUserId: string;
  pageAccessToken: string;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  mediaType: 'IMAGE' | 'STORIES' | 'REELS';
}): Promise<InstagramMediaPublishResult> {
  const containerUrl = new URL(`${META_GRAPH_BASE}/${input.igUserId}/media`);
  containerUrl.searchParams.set('access_token', input.pageAccessToken);

  if (input.videoUrl) {
    containerUrl.searchParams.set('video_url', input.videoUrl);
    if (input.mediaType === 'REELS') {
      containerUrl.searchParams.set('media_type', 'REELS');
    } else if (input.mediaType === 'STORIES') {
      containerUrl.searchParams.set('media_type', 'STORIES');
    }
  } else if (input.imageUrl) {
    containerUrl.searchParams.set('image_url', input.imageUrl);
    if (input.mediaType === 'STORIES') {
      containerUrl.searchParams.set('media_type', 'STORIES');
    }
  } else {
    throw new Error('imageUrl or videoUrl is required');
  }

  if (input.mediaType === 'IMAGE' && input.caption?.trim()) {
    containerUrl.searchParams.set('caption', input.caption.trim());
  }

  const containerRes = await fetch(containerUrl.toString(), { method: 'POST' });
  const containerJson = await parseMetaGraphJson(containerRes);
  if (!containerRes.ok || !containerJson.id) {
    throw new Error(metaApiError(containerJson, 'Instagram media container failed'));
  }

  const creationId = String(containerJson.id);

  if (input.videoUrl) {
    await waitForInstagramContainerReady(creationId, input.pageAccessToken);
  }

  const publishUrl = new URL(`${META_GRAPH_BASE}/${input.igUserId}/media_publish`);
  publishUrl.searchParams.set('creation_id', creationId);
  publishUrl.searchParams.set('access_token', input.pageAccessToken);

  const publishRes = await fetch(publishUrl.toString(), { method: 'POST' });
  const publishJson = await parseMetaGraphJson(publishRes);
  if (!publishRes.ok || !publishJson.id) {
    throw new Error(metaApiError(publishJson, 'Instagram media publish failed'));
  }

  return { mediaId: String(publishJson.id) };
}
