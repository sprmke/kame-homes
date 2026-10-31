import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { callEdgeFunction, getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

export type SuperhostAssessmentCronResult = {
  assessed: number;
  earned: number;
  lost: number;
  skipped: number;
};

export type ReassessOrgSuperhostResult = {
  orgId: string;
  assessmentKey: string;
  earned: boolean;
  previousEarned: boolean;
  skipped?: boolean;
  reason?: string;
};

async function callSuperhostCron(): Promise<SuperhostAssessmentCronResult> {
  const jwt = await getSessionJwt();
  const res = await fetch(`${FUNCTIONS_URL}/superhost-assessment-cron`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ force: true }),
  });
  const json = (await res.json()) as SuperhostAssessmentCronResult & {
    success?: boolean;
    error?: string;
  };
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed');
  }
  return {
    assessed: json.assessed ?? 0,
    earned: json.earned ?? 0,
    lost: json.lost ?? 0,
    skipped: json.skipped ?? 0,
  };
}

export function useRunSuperhostAssessmentCron() {
  return useMutation({
    mutationFn: () => callSuperhostCron(),
    onSuccess: (result) => {
      toast.success(
        `Superhost cron: ${result.assessed} assessed, ${result.earned} earned, ${result.lost} lost, ${result.skipped} skipped`
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Superhost cron failed');
    },
  });
}

export function useReassessOrgSuperhost() {
  return useMutation({
    mutationFn: (orgId: string) =>
      callEdgeFunction<ReassessOrgSuperhostResult>('reassess-org-superhost', {
        method: 'POST',
        body: JSON.stringify({ orgId }),
      }),
    onSuccess: (result) => {
      if (result.skipped) {
        toast.message(`Superhost reassess skipped (${result.reason ?? 'unknown'})`);
        return;
      }
      toast.success(
        result.earned
          ? 'Superhost earned for this organization'
          : 'Superhost not earned. Criteria not met'
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Reassess failed');
    },
  });
}
