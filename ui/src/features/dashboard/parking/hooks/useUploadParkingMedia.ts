import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PARKINGS_QUERY_KEY } from '@/features/dashboard/org/hooks/useParkings';
import {
  scopedParkingFunctionsBaseUrl,
  useParkingIdParam,
} from '@/features/dashboard/org/lib/adminParkingScope';

import { prepareUpload } from '@/lib/media/prepareUpload';
import { supabase } from '@/lib/supabase/client';

type ParkingCoverResult = {
  coverImage: string | null;
  coverImageStoragePath: string | null;
};

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

export function useUploadParkingMedia() {
  const qc = useQueryClient();
  const parkingId = useParkingIdParam();

  const upload = useMutation({
    mutationFn: async (rawFile: File): Promise<ParkingCoverResult> => {
      const prepared = await prepareUpload(rawFile, {
        imagePreset: 'PHOTO_MASTER',
        surface: 'parking-media',
      });
      if (prepared.error) throw new Error(prepared.error);
      const file = prepared.file;

      const jwt = await getAdminJwt();
      const body = new FormData();
      body.append('file', file);
      body.append('fileName', file.name);

      const res = await fetch(scopedParkingFunctionsBaseUrl('/upload-parking-media', parkingId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body,
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: ParkingCoverResult;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PARKINGS_QUERY_KEY });
    },
  });

  const remove = useMutation({
    mutationFn: async (): Promise<ParkingCoverResult> => {
      const jwt = await getAdminJwt();
      const res = await fetch(scopedParkingFunctionsBaseUrl('/upload-parking-media', parkingId), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jwt}` },
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: ParkingCoverResult;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PARKINGS_QUERY_KEY });
    },
  });

  return { upload, remove };
}
