/**
 * useUpdateImportRow — persist row skip/include or field fixes via import-update-row.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { importPreviewQueryKey } from '@/features/dashboard/import/hooks/useImportBatchRows';
import type {
  ImportPreviewResult,
  ImportPreviewSummary,
  ImportValidationError,
} from '@/features/dashboard/import/types/importBatch';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

async function getSessionJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

type UpdateRowToggleInput = {
  batchId: string;
  rowId: string;
  validationStatus: 'skipped' | 'valid';
};

type UpdateRowFieldInput = {
  batchId: string;
  rowId: string;
  fieldValues: Record<string, string>;
};

export type UpdateImportRowInput = UpdateRowToggleInput | UpdateRowFieldInput;

type UpdateRowResult = {
  batchId: string;
  rowId: string;
  validationStatus: 'valid' | 'error' | 'skipped';
  validationErrors: ImportValidationError[];
  mappedData?: Record<string, string | null>;
  summary: ImportPreviewSummary;
};

function isFieldPatchInput(input: UpdateImportRowInput): input is UpdateRowFieldInput {
  return 'fieldValues' in input;
}

function shiftSummaryStatus(
  summary: ImportPreviewSummary,
  from: 'valid' | 'error' | 'skipped' | null,
  to: 'valid' | 'error' | 'skipped'
): ImportPreviewSummary {
  const next = { ...summary };
  if (from === 'valid') next.valid = Math.max(0, next.valid - 1);
  if (from === 'error') next.error = Math.max(0, next.error - 1);
  if (from === 'skipped') next.skipped = Math.max(0, next.skipped - 1);
  if (to === 'valid') next.valid += 1;
  if (to === 'error') next.error += 1;
  if (to === 'skipped') next.skipped += 1;
  return next;
}

function applyPreviewRowPatch(
  preview: ImportPreviewResult,
  rowId: string,
  patch: {
    validationStatus: 'valid' | 'error' | 'skipped';
    validationErrors?: ImportValidationError[];
    mappedData?: Record<string, string | null>;
  },
  nextSummary?: ImportPreviewSummary
): ImportPreviewResult {
  const current = preview.rows.find((row) => row.id === rowId);
  const summary =
    nextSummary ??
    (current && current.validationStatus !== patch.validationStatus
      ? shiftSummaryStatus(preview.summary, current.validationStatus, patch.validationStatus)
      : preview.summary);

  return {
    ...preview,
    summary,
    rows: preview.rows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            validationStatus: patch.validationStatus,
            validationErrors: patch.validationErrors ?? row.validationErrors,
            mappedData: patch.mappedData ?? row.mappedData,
          }
        : row
    ),
  };
}

export function useUpdateImportRow(batchId: string | null) {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateImportRowInput): Promise<UpdateRowResult> => {
      if (!propertyId) throw new Error('Property context is required');

      const jwt = await getSessionJwt();
      const res = await fetch(scopedFunctionsUrl('/import-update-row', propertyId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: UpdateRowResult;
      };

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      return json.data;
    },
    onMutate: async (input) => {
      if (!propertyId || !batchId) return undefined;
      if (isFieldPatchInput(input)) return undefined;

      const key = importPreviewQueryKey(propertyId, batchId);
      const previous = queryClient.getQueryData<ImportPreviewResult>(key);
      if (!previous) return { previous: undefined, key };

      const optimisticStatus = input.validationStatus;
      queryClient.setQueryData(
        key,
        applyPreviewRowPatch(previous, input.rowId, {
          validationStatus: optimisticStatus,
          // Keep prior issues when skipping so the Fix modal still has fields to restore/fix.
        })
      );

      return { previous, key };
    },
    onError: (error, _input, context) => {
      if (context?.previous && context.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
      toast.error((error as Error).message);
    },
    onSuccess: (data, _input, context) => {
      if (!propertyId || !batchId) return;
      const key = context?.key ?? importPreviewQueryKey(propertyId, batchId);
      const current = queryClient.getQueryData<ImportPreviewResult>(key);
      if (!current) return;

      queryClient.setQueryData(
        key,
        applyPreviewRowPatch(
          current,
          data.rowId,
          {
            validationStatus: data.validationStatus,
            validationErrors: data.validationErrors,
            mappedData: data.mappedData,
          },
          data.summary
        )
      );
    },
  });
}
