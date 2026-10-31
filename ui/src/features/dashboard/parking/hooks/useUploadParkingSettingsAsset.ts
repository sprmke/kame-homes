import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  scopedParkingFunctionsBaseUrl,
  useParkingIdParam,
} from '@/features/dashboard/org/lib/adminParkingScope';
import { PARKING_SETTINGS_QUERY_KEY } from '@/features/dashboard/parking/hooks/useParkingSettings';

import { prepareUpload } from '@/lib/media/prepareUpload';
import { supabase } from '@/lib/supabase/client';

type UploadParkingSettingsAssetResult = {
  url: string;
  bucket: string;
  path: string;
  column?: string;
};

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

export function useUploadParkingSettingsAsset() {
  const qc = useQueryClient();
  const parkingId = useParkingIdParam();

  return useMutation({
    mutationFn: async (rawFile: File): Promise<UploadParkingSettingsAssetResult> => {
      const prepared = await prepareUpload(rawFile, {
        imagePreset: 'DOCUMENT',
        surface: 'parking-settings-gcash-qr',
      });
      if (prepared.error) throw new Error(prepared.error);
      const file = prepared.file;

      const jwt = await getAdminJwt();
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const body = new FormData();
      body.append('assetType', 'gcash_qr');
      body.append('file', file);
      body.append('fileName', `gcash_qr${ext}`);

      const res = await fetch(
        scopedParkingFunctionsBaseUrl('/upload-parking-settings-asset', parkingId),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${jwt}` },
          body,
        }
      );

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: UploadParkingSettingsAssetResult;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [...PARKING_SETTINGS_QUERY_KEY, parkingId] });
    },
  });
}
