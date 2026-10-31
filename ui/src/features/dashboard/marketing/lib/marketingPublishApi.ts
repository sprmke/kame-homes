import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { usePropertyIdParam, scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import {
  handleAiMutationError,
  isAiQuotaError,
  parseEdgeJsonOrQuota,
} from '@/features/dashboard/org/lib/aiQuotaToast';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type PublishToMetaPayload = {
  platform: 'facebook' | 'instagram';
  postType: 'post' | 'story';
  caption: string;
  connectionId: string;
  mediaType: 'image' | 'video';
  /** Base64 data URL or remote URL */
  mediaUrl: string;
  templateId?: string;
};

export type MarketingPublication = {
  id: string;
  platform: string;
  publishType: string;
  status: string;
  caption: string | null;
  metaPostId: string | null;
  errorMessage: string | null;
  publishedAt: string | null;
  createdAt: string;
};

export type GenerateCaptionPayload = {
  platform: 'facebook' | 'instagram';
  postType: 'post' | 'story';
  contentHint?: string;
  nightlyRate?: string;
  availabilityText?: string;
};

async function parseEdgeJson<T>(res: Response): Promise<T> {
  return parseEdgeJsonOrQuota<T>(res);
}

export async function publishToMetaRequest(
  propertyId: string | null,
  payload: PublishToMetaPayload
): Promise<{ postId?: string; publicationId?: string }> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('publish-to-meta', propertyId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      connectionId: payload.connectionId,
      platform: payload.platform,
      postType: payload.postType,
      mediaUrl: payload.mediaUrl,
      mediaType: payload.mediaType,
      caption: payload.caption,
    }),
  });

  return parseEdgeJson(res);
}

export async function fetchMarketingPublications(
  propertyId: string | null
): Promise<MarketingPublication[]> {
  const jwt = await getSessionJwt();
  const url = new URL(scopedFunctionsUrl('publish-to-meta', propertyId));
  url.searchParams.set('limit', '40');
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const data = await parseEdgeJson<{ publications: MarketingPublication[] }>(res);
  return data.publications ?? [];
}

export async function generateMarketingCaptionRequest(
  propertyId: string | null,
  payload: GenerateCaptionPayload
): Promise<string> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('generate-marketing-caption', propertyId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await parseEdgeJson<{ caption: string }>(res);
  return data.caption;
}

export function usePublishToMeta() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PublishToMetaPayload) => publishToMetaRequest(propertyId, payload),
    onSuccess: () => {
      toast.success('Published');
      void queryClient.invalidateQueries({ queryKey: ['marketing-publications', propertyId] });
    },
    onError: (error: Error) => {
      if (isAiQuotaError(error)) {
        handleAiMutationError(error);
        return;
      }
      toast.error(error.message || 'Publish failed');
    },
  });
}

export function useMarketingPublications() {
  const propertyId = usePropertyIdParam();

  return useQuery({
    queryKey: ['marketing-publications', propertyId],
    queryFn: () => fetchMarketingPublications(propertyId),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useGenerateMarketingCaption() {
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: (payload: GenerateCaptionPayload) =>
      generateMarketingCaptionRequest(propertyId, payload),
    onError: (error: Error) => handleAiMutationError(error),
  });
}

export async function publishBatchToMeta(
  propertyId: string | null,
  payloads: PublishToMetaPayload[]
): Promise<Array<{ connectionId: string; ok: boolean; error?: string }>> {
  const results: Array<{ connectionId: string; ok: boolean; error?: string }> = [];

  for (const payload of payloads) {
    try {
      await publishToMetaRequest(propertyId, payload);
      results.push({ connectionId: payload.connectionId, ok: true });
    } catch (error) {
      results.push({
        connectionId: payload.connectionId,
        ok: false,
        error: (error as Error).message,
      });
    }
  }

  return results;
}
