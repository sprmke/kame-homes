/**
 * useUploadDevelopmentMedia — upload/delete development gallery media (super admin).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { PropertyMediaItem } from '@/features/dashboard/org/lib/propertySettingsConstants';

import { prepareUpload } from '@/lib/media/prepareUpload';
import { supabase } from '@/lib/supabase/client';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

type UploadDevelopmentMediaResult = {
  item: PropertyMediaItem;
  media: PropertyMediaItem[];
};

type DeleteDevelopmentMediaResult = {
  media: PropertyMediaItem[];
};

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

export function useUploadDevelopmentMedia(developmentId: string | undefined) {
  const qc = useQueryClient();

  const upload = useMutation({
    mutationFn: async (rawFile: File): Promise<UploadDevelopmentMediaResult> => {
      if (!developmentId) throw new Error('Development context is required');

      const prepared = await prepareUpload(rawFile, {
        imagePreset: 'PHOTO_MASTER',
        surface: 'development-media',
      });
      if (prepared.error) throw new Error(prepared.error);
      const file = prepared.file;

      const jwt = await getAdminJwt();
      const body = new FormData();
      body.append('file', file);
      body.append('fileName', file.name);

      const res = await fetch(
        `${FUNCTIONS_URL}/upload-development-media?development_id=${encodeURIComponent(developmentId)}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${jwt}` },
          body,
        }
      );

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: UploadDevelopmentMediaResult;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['super-admin', 'development'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (args: {
      mediaId: string;
      storagePath?: string;
    }): Promise<DeleteDevelopmentMediaResult> => {
      if (!developmentId) throw new Error('Development context is required');

      const jwt = await getAdminJwt();
      const res = await fetch(
        `${FUNCTIONS_URL}/upload-development-media?development_id=${encodeURIComponent(developmentId)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mediaId: args.mediaId,
            storagePath: args.storagePath,
          }),
        }
      );

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: DeleteDevelopmentMediaResult;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json.data;
    },
    onSuccess: async (_data, _vars, _ctx) => {
      await qc.invalidateQueries({ queryKey: ['super-admin', 'development'] });
    },
  });

  return { upload, remove };
}
