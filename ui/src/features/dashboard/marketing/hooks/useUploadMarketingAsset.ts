/**
 * useUploadMarketingAsset — persistent upload for Design canvas assets (collage
 * cell photos + Polotno's own Upload panel). Replaces `URL.createObjectURL`,
 * whose `blob:` URLs autosave would otherwise write into `design_json.polotno`
 * verbatim — dead on the next page load.
 */
import { useMutation } from '@tanstack/react-query';

import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

import { prepareUpload } from '@/lib/media/prepareUpload';

export type MarketingAssetUploadResult = {
  url: string;
  storagePath: string;
  width: number | null;
  height: number | null;
};

export function useUploadMarketingAsset() {
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async (rawFile: File): Promise<MarketingAssetUploadResult> => {
      if (!propertyId) throw new Error('Property context is required');

      const prepared = await prepareUpload(rawFile, {
        imagePreset: 'PHOTO_MASTER',
        surface: 'marketing-uploads',
      });
      if (prepared.error) throw new Error(prepared.error);
      const file = prepared.file;

      const jwt = await getSessionJwt();
      const body = new FormData();
      body.append('file', file);

      const res = await fetch(scopedFunctionsUrl('/upload-marketing-asset', propertyId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body,
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: MarketingAssetUploadResult;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json.data;
    },
  });
}
