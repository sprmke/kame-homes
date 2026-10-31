/**
 * useCommitImportBatch — commit a previewed import batch into guest_submissions.
 */

import { useMutation } from '@tanstack/react-query';

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

export type CommitImportBatchFailure = { rowIndex: number; reason: string };

/** import-commit HTTP 200 payload — status reflects batch outcome, not HTTP success alone. */
export type CommitImportBatchResult = {
  batchId: string;
  status: 'committed' | 'failed' | 'previewed';
  inserted: number;
  skipped: number;
  failed: CommitImportBatchFailure[];
};

export function useCommitImportBatch() {
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async (batchId: string): Promise<CommitImportBatchResult> => {
      if (!propertyId) throw new Error('Property context is required');

      const jwt = await getSessionJwt();
      const res = await fetch(scopedFunctionsUrl('/import-commit', propertyId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchId }),
      });

      const json = await readImportEdgeJson<CommitImportBatchResult>(res);

      if (!res.ok || !json.success || !json.data) {
        throw new Error(importEdgeErrorMessage(json, res.status, 'Could not import bookings'));
      }

      return json.data;
    },
  });
}
