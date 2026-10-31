import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PROPERTY_TEMPLATES_QUERY_KEY } from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { prepareUpload } from '@/lib/media/prepareUpload';
import { supabase } from '@/lib/supabase/client';

type UploadResult = {
  url: string;
  bucket: string;
  path: string;
  templateKey: string | null;
};

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

type SectionUploadArgs = {
  assetType: 'section_image';
  templateKey: string;
  file: File;
};

type InlineUploadArgs = {
  assetType: 'inline_image';
  file: File;
};

export function useUploadPropertyTemplateAsset() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SectionUploadArgs | InlineUploadArgs): Promise<UploadResult> => {
      const prepared = await prepareUpload(input.file, {
        imagePreset: 'CONTENT',
        surface: `property-template-${input.assetType}`,
      });
      if (prepared.error) throw new Error(prepared.error);
      const file = prepared.file;

      const jwt = await getAdminJwt();
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const storageName =
        input.assetType === 'section_image'
          ? `${input.templateKey}${ext}`
          : `inline-${Date.now()}${ext}`;

      const body = new FormData();
      body.append('assetType', input.assetType);
      body.append('file', file);
      body.append('fileName', storageName);
      if (input.assetType === 'section_image') {
        body.append('templateKey', input.templateKey);
      }

      const res = await fetch(scopedFunctionsUrl('/upload-property-template-asset', propertyId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body,
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: UploadResult;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json.data;
    },
    onSuccess: (_data, variables) => {
      if (variables.assetType === 'section_image') {
        void queryClient.invalidateQueries({
          queryKey: [...PROPERTY_TEMPLATES_QUERY_KEY, propertyId],
        });
      }
    },
  });
}
