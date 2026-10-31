/**
 * useSaveImportMapping — persist user-confirmed column mapping via import-save-mapping.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { clearImportPreviewCache } from '@/features/dashboard/import/hooks/useImportBatchRows';
import {
  importEdgeErrorMessage,
  readImportEdgeJson,
} from '@/features/dashboard/import/lib/importEdgeResponse';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

async function getSessionJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

type SaveMappingInput = {
  batchId: string;
  /** rawHeader → targetFieldId or null to skip */
  columnMapping: Record<string, string | null>;
};

type SaveMappingResult = {
  batchId: string;
  status: string;
};

export function useSaveImportMapping() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      batchId,
      columnMapping,
    }: SaveMappingInput): Promise<SaveMappingResult> => {
      if (!propertyId) throw new Error('Property context is required');

      const jwt = await getSessionJwt();
      const res = await fetch(scopedFunctionsUrl('/import-save-mapping', propertyId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchId, columnMapping }),
      });

      const json = await readImportEdgeJson<SaveMappingResult>(res);

      if (!res.ok || !json.success || !json.data) {
        throw new Error(importEdgeErrorMessage(json, res.status, 'Could not save column mapping'));
      }

      return json.data;
    },
    onSuccess: (_data, { batchId }) => {
      clearImportPreviewCache(queryClient, propertyId ?? undefined, batchId);
    },
  });
}
