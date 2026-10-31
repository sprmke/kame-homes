/**
 * useImportPreview — run import-preview edge function.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { importPreviewQueryKey } from '@/features/dashboard/import/hooks/useImportBatchRows';
import {
  importEdgeErrorMessage,
  readImportEdgeJson,
} from '@/features/dashboard/import/lib/importEdgeResponse';
import type { ImportPreviewResult } from '@/features/dashboard/import/types/importBatch';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

async function getSessionJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

export function useImportPreview() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string): Promise<ImportPreviewResult> => {
      if (!propertyId) throw new Error('Property context is required');

      const jwt = await getSessionJwt();
      const res = await fetch(scopedFunctionsUrl('/import-preview', propertyId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchId }),
      });

      const json = await readImportEdgeJson<ImportPreviewResult>(res);

      if (!res.ok || !json.success || !json.data) {
        throw new Error(importEdgeErrorMessage(json, res.status, 'Could not preview import'));
      }

      return json.data;
    },
    onSuccess: (data) => {
      if (!propertyId) return;
      queryClient.setQueryData(importPreviewQueryKey(propertyId, data.batchId), data);
    },
  });
}
