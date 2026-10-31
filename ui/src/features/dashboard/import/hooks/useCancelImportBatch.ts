/**
 * useCancelImportBatch — delete a batch + storage before it is committed.
 */

import { useMutation } from '@tanstack/react-query';

import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

async function getSessionJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

export function useCancelImportBatch() {
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async (batchId: string): Promise<void> => {
      if (!propertyId) throw new Error('Property context is required');

      const jwt = await getSessionJwt();
      const res = await fetch(scopedFunctionsUrl('/import-cancel', propertyId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchId }),
      });

      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
    },
  });
}
