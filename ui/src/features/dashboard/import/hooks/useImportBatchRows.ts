/**
 * useImportBatchRows — read preview rows from TanStack Query cache.
 */

import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ImportBatchRowPreview,
  ImportPreviewResult,
  ImportPreviewSummary,
} from '@/features/dashboard/import/types/importBatch';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export const IMPORT_PREVIEW_KEY = ['import-preview'] as const;

export function importPreviewQueryKey(propertyId: string, batchId: string) {
  return [...IMPORT_PREVIEW_KEY, propertyId, batchId] as const;
}

/** Drop cached preview so the next Preview step re-runs import-preview. */
export function clearImportPreviewCache(
  queryClient: QueryClient,
  propertyId: string | undefined,
  batchId: string | null | undefined
): void {
  if (!propertyId || !batchId) return;
  queryClient.removeQueries({ queryKey: importPreviewQueryKey(propertyId, batchId) });
}

const EMPTY_SUMMARY: ImportPreviewSummary = {
  total: 0,
  valid: 0,
  error: 0,
  skipped: 0,
  warning: 0,
};

export function useImportBatchRows(batchId: string | null) {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey:
      propertyId && batchId ? importPreviewQueryKey(propertyId, batchId) : IMPORT_PREVIEW_KEY,
    enabled: Boolean(propertyId && batchId),
    queryFn: (): ImportPreviewResult | null => {
      if (!propertyId || !batchId) return null;
      return (
        queryClient.getQueryData<ImportPreviewResult>(importPreviewQueryKey(propertyId, batchId)) ??
        null
      );
    },
    staleTime: Infinity,
  });

  const preview = query.data;
  const rows: ImportBatchRowPreview[] = preview?.rows ?? [];
  const summary = preview?.summary ?? EMPTY_SUMMARY;

  return {
    rows,
    summary,
    status: preview?.status ?? null,
    isReady: Boolean(preview?.rows.length),
    clearPreviewCache: () => clearImportPreviewCache(queryClient, propertyId ?? undefined, batchId),
    updatePreviewCache: (next: ImportPreviewResult) => {
      if (!propertyId || !batchId) return;
      queryClient.setQueryData(importPreviewQueryKey(propertyId, batchId), next);
    },
    patchRow: (
      rowId: string,
      patch: Partial<ImportBatchRowPreview>,
      nextSummary?: ImportPreviewSummary
    ) => {
      if (!propertyId || !batchId) return;
      const current = queryClient.getQueryData<ImportPreviewResult>(
        importPreviewQueryKey(propertyId, batchId)
      );
      if (!current) return;

      const updated: ImportPreviewResult = {
        ...current,
        summary: nextSummary ?? current.summary,
        rows: current.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
      };
      queryClient.setQueryData(importPreviewQueryKey(propertyId, batchId), updated);
    },
    patchSummary: (nextSummary: ImportPreviewSummary) => {
      if (!propertyId || !batchId) return;
      const current = queryClient.getQueryData<ImportPreviewResult>(
        importPreviewQueryKey(propertyId, batchId)
      );
      if (!current) return;
      queryClient.setQueryData(importPreviewQueryKey(propertyId, batchId), {
        ...current,
        summary: nextSummary,
      });
    },
  };
}
