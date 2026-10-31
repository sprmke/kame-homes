/**
 * useImportParseFile — upload CSV/Excel to import-parse-file edge function.
 */

import { useMutation } from '@tanstack/react-query';

import {
  importEdgeErrorMessage,
  readImportEdgeJson,
} from '@/features/dashboard/import/lib/importEdgeResponse';
import type { ImportParseResult } from '@/features/dashboard/import/types/importParse';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

async function getSessionJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again, then try uploading.');
  return token;
}

function friendlyParseError(raw: string | undefined, status: number): string {
  const message = (raw ?? '').trim();
  const lower = message.toLowerCase();
  if (lower.includes('bucket') || lower.includes('storage')) {
    return 'Upload storage is not ready. Ask your admin to apply the latest database migrations, then try again.';
  }
  if (lower.includes('too many') || (lower.includes('row') && lower.includes('limit'))) {
    return message || 'This file has too many rows. Split it and try again.';
  }
  if (
    lower.includes('csv') ||
    lower.includes('excel') ||
    lower.includes('xlsx') ||
    lower.includes('parse') ||
    lower.includes('sheet')
  ) {
    return message || 'We could not read that file. Check the format and try again.';
  }
  return importEdgeErrorMessage({ error: raw }, status, 'Upload failed');
}

export function useImportParseFile() {
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async (file: File): Promise<ImportParseResult> => {
      if (!propertyId) throw new Error('Open this page from a property to import bookings.');

      const jwt = await getSessionJwt();
      const body = new FormData();
      body.append('file', file);
      body.append('fileName', file.name);

      const res = await fetch(scopedFunctionsUrl('/import-parse-file', propertyId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body,
      });

      const json = await readImportEdgeJson<
        Partial<ImportParseResult> & Omit<ImportParseResult, 'fileName'>
      >(res);

      if (!res.ok || !json.success || !json.data) {
        throw new Error(friendlyParseError(json.error, res.status));
      }

      // Older deploys of import-parse-file omit fileName.
      return { ...json.data, fileName: json.data.fileName || file.name };
    },
  });
}
