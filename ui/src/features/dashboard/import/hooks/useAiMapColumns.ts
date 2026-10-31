/**
 * useAiMapColumns — call import-ai-map-columns edge function.
 */

import { useMutation } from '@tanstack/react-query';

import {
  importEdgeErrorMessage,
  readImportEdgeJson,
} from '@/features/dashboard/import/lib/importEdgeResponse';
import type { AiMapColumnsResult } from '@/features/dashboard/import/types/importBatch';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

async function getSessionJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

export function useAiMapColumns() {
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async (batchId: string): Promise<AiMapColumnsResult> => {
      if (!propertyId) throw new Error('Property context is required');

      const jwt = await getSessionJwt();
      const res = await fetch(scopedFunctionsUrl('/import-ai-map-columns', propertyId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchId }),
      });

      const json = await readImportEdgeJson<AiMapColumnsResult>(res);

      if (!res.ok || !json.success || !json.data) {
        throw new Error(importEdgeErrorMessage(json, res.status, 'Could not match columns'));
      }

      return json.data;
    },
  });
}
