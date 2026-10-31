import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type JamendoTrack = {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  imageUrl: string | null;
  streamUrl: string;
  downloadUrl: string;
};

export type ImportedMarketingMusic = {
  url: string;
  title?: string;
  artist?: string;
  source: 'jamendo' | 'upload' | 'url';
  trackId?: string;
};

export const MARKETING_MUSIC_QUERY_KEY = ['marketing-music'] as const;

async function parseEdgeJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { success?: boolean; error?: string; data?: T };
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed');
  }
  return json.data as T;
}

function marketingMusicGetUrl(propertyId: string | null, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  const path = qs ? `marketing-music?${qs}` : 'marketing-music';
  return scopedFunctionsUrl(path, propertyId);
}

export function useMarketingMusicBrowse(
  propertyId: string | null,
  options: { q?: string; order?: string; enabled?: boolean } = {}
) {
  const { q, order = 'popularity_week', enabled = true } = options;
  return useQuery({
    queryKey: [...MARKETING_MUSIC_QUERY_KEY, 'browse', propertyId, q ?? '', order],
    queryFn: async () => {
      const jwt = await getSessionJwt();
      const params: Record<string, string> = { order };
      if (q?.trim()) params.q = q.trim();
      const res = await fetch(marketingMusicGetUrl(propertyId, params), {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      return parseEdgeJson<{ tracks: JamendoTrack[]; jamendoConfigured: boolean }>(res);
    },
    enabled: Boolean(propertyId) && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}

async function postMarketingMusicJson(
  propertyId: string | null,
  body: Record<string, unknown>
): Promise<ImportedMarketingMusic> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('marketing-music', propertyId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return parseEdgeJson<ImportedMarketingMusic>(res);
}

export function useImportJamendoTrack(propertyId: string | null) {
  return useMutation({
    mutationFn: (trackId: string) =>
      postMarketingMusicJson(propertyId, { action: 'import-jamendo', trackId }),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not import track');
    },
  });
}

export function useImportMusicUrl(propertyId: string | null) {
  return useMutation({
    mutationFn: (url: string) => postMarketingMusicJson(propertyId, { action: 'import-url', url }),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not import URL');
    },
  });
}

export function useUploadMarketingMusic(propertyId: string | null) {
  return useMutation({
    mutationFn: async (input: File | { file: File; fileKey?: string }) => {
      const file = input instanceof File ? input : input.file;
      const fileKey = input instanceof File ? undefined : input.fileKey;
      const jwt = await getSessionJwt();
      const formData = new FormData();
      formData.append('file', file);
      if (fileKey) formData.append('fileKey', fileKey);
      const res = await fetch(scopedFunctionsUrl('marketing-music', propertyId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: formData,
      });
      return parseEdgeJson<ImportedMarketingMusic>(res);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    },
  });
}

function sanitizeFileStem(value: string): string {
  const stem = value
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return stem.slice(0, 48) || 'track';
}

/** Jamendo stream URLs are browser-only; fetch client-side then upload to Storage. */
export async function fetchJamendoStreamAsFile(track: JamendoTrack): Promise<File> {
  const res = await fetch(track.streamUrl);
  if (!res.ok) {
    throw new Error(`Could not fetch audio (${res.status})`);
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error('Audio file is empty');
  }

  const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'audio/mpeg';
  const name = `${sanitizeFileStem(track.title)}.mp3`;
  return new File([blob], name, { type });
}

export async function fetchUrlAsAudioFile(url: string): Promise<File> {
  const trimmed = url.trim();
  const res = await fetch(trimmed);
  if (!res.ok) {
    throw new Error(`Could not fetch audio (${res.status})`);
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error('Audio file is empty');
  }

  const pathName = trimmed.split('/').pop()?.split('?')[0] ?? 'audio.mp3';
  const hasExt = /\.(mp3|m4a|wav|ogg|aac|webm)$/i.test(pathName);
  const name = hasExt ? pathName : `${pathName}.mp3`;
  const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'audio/mpeg';
  return new File([blob], name, { type });
}
