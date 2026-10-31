/**
 * useUploadPropertyMedia — upload/delete property gallery media.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import type { PropertyMediaItem } from '@/features/dashboard/org/lib/propertySettingsConstants';

import { prepareUpload } from '@/lib/media/prepareUpload';
import { supabase } from '@/lib/supabase/client';

type UploadPropertyMediaResult = {
  item: PropertyMediaItem;
  media: PropertyMediaItem[];
};

type DeletePropertyMediaResult = {
  media: PropertyMediaItem[];
};

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

export function useUploadPropertyMedia() {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  const upload = useMutation({
    mutationFn: async (rawFile: File): Promise<UploadPropertyMediaResult> => {
      if (!propertyId) throw new Error('Property context is required');

      const prepared = await prepareUpload(rawFile, {
        imagePreset: 'PHOTO_MASTER',
        surface: 'property-media',
      });
      if (prepared.error) throw new Error(prepared.error);
      const file = prepared.file;

      const jwt = await getAdminJwt();
      const body = new FormData();
      body.append('file', file);
      body.append('fileName', file.name);

      const res = await fetch(scopedFunctionsUrl('/upload-property-media', propertyId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body,
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: UploadPropertyMediaResult;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (args: {
      mediaId: string;
      storagePath?: string;
    }): Promise<DeletePropertyMediaResult> => {
      if (!propertyId) throw new Error('Property context is required');

      const jwt = await getAdminJwt();
      const res = await fetch(scopedFunctionsUrl('/upload-property-media', propertyId), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaId: args.mediaId,
          storagePath: args.storagePath,
        }),
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: DeletePropertyMediaResult;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  return { upload, remove };
}
