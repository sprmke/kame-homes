import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type {
  OpsReportListRow,
  OpsReportRecord,
} from '@/features/dashboard/super-admin/lib/opsReports';

const FN = 'ops-report';
const LIST_KEY = ['super-admin', 'ops-reports', 'list'] as const;
const DETAIL_KEY = (id: string) => ['super-admin', 'ops-reports', 'detail', id] as const;

export function useOpsReports(limit = 20) {
  return useQuery({
    queryKey: [...LIST_KEY, limit],
    queryFn: async () =>
      (await callEdgeFunction<{ reports: OpsReportListRow[] }>(`${FN}?limit=${limit}`)).reports,
    staleTime: 60_000,
  });
}

export function useOpsReport(id: string | undefined) {
  return useQuery({
    queryKey: DETAIL_KEY(id ?? ''),
    queryFn: async () =>
      (await callEdgeFunction<{ report: OpsReportRecord }>(`${FN}?id=${encodeURIComponent(id!)}`))
        .report,
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useGenerateOpsReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (
        await callEdgeFunction<{ report: OpsReportRecord }>(FN, {
          method: 'POST',
          body: JSON.stringify({ action: 'generate' }),
        })
      ).report,
    onSuccess: async (report) => {
      toast.success('Report generated');
      await qc.invalidateQueries({ queryKey: ['super-admin', 'ops-reports'] });
      await qc.invalidateQueries({ queryKey: DETAIL_KEY(report.id) });
    },
    onError: (error: Error) => toast.error(error.message || 'Could not generate the report'),
  });
}

export function useSendOpsReportEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reportId: string; force?: boolean }) =>
      callEdgeFunction<{ sent: boolean; reason?: string; recipients?: string[]; error?: string }>(
        FN,
        { method: 'POST', body: JSON.stringify({ action: 'send', ...input }) }
      ),
    onSuccess: async (result) => {
      if (result.sent) {
        toast.success(`Report sent to ${result.recipients?.length ?? 0} recipient(s)`);
      } else if (result.reason === 'already_sent') {
        toast.message('Already sent for this period');
      } else {
        toast.error(result.error ?? 'Could not send the report');
      }
      await qc.invalidateQueries({ queryKey: ['super-admin', 'ops-reports'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Could not send the report'),
  });
}
