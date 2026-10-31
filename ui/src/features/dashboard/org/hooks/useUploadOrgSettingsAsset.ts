import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import { scopedOrgFunctionsUrl, useOrgScopeKey } from '@/features/dashboard/org/lib/adminApiScope';

import { prepareUpload } from '@/lib/media/prepareUpload';
import { supabase } from '@/lib/supabase/client';

type UploadOrgSettingsAssetResult = {
  url: string;
  bucket: string;
  path: string;
  column: string;
};

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

export function useUploadOrgSettingsAsset() {
  const qc = useQueryClient();
  const { orgSlug, orgId } = useOrgScopeKey();

  return useMutation({
    mutationFn: async (rawFile: File): Promise<UploadOrgSettingsAssetResult> => {
      const prepared = await prepareUpload(rawFile, {
        imagePreset: 'AVATAR',
        surface: 'org-settings-logo',
      });
      if (prepared.error) throw new Error(prepared.error);
      const file = prepared.file;

      const jwt = await getAdminJwt();
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const storageName = `team_logo${ext}`;

      const body = new FormData();
      body.append('assetType', 'team_logo');
      body.append('file', file);
      body.append('fileName', storageName);

      const res = await fetch(scopedOrgFunctionsUrl('/upload-org-settings-asset', orgSlug, orgId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body,
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: UploadOrgSettingsAssetResult;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      return json.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['org-settings'] });
      await qc.invalidateQueries({ queryKey: ['app-settings'] });
      await qc.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
    },
  });
}
