import { useQuery } from '@tanstack/react-query';

import { scopedOrgFunctionsUrl, useOrgScopeKey } from '@/features/dashboard/org/lib/adminApiScope';
import type { OrgSuperhostCriteriaSnapshot } from '@/features/dashboard/org/lib/orgSuperhost';

import { supabase } from '@/lib/supabase/client';

export type OrgSuperhostProgressDto = {
  earned: boolean;
  earnedAt: string | null;
  lastAssessmentAt: string | null;
  nextAssessmentAt: string;
  assessmentKey: string;
  criteria: OrgSuperhostCriteriaSnapshot;
  allCriteriaMet: boolean;
};

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

export function useOrgSuperhostProgress(enabled = true) {
  const { orgSlug, orgId } = useOrgScopeKey();

  return useQuery({
    queryKey: ['org-superhost-progress', orgSlug, orgId],
    enabled: enabled && Boolean(orgSlug || orgId),
    queryFn: async (): Promise<OrgSuperhostProgressDto> => {
      const token = await getAdminJwt();
      const url = scopedOrgFunctionsUrl('/get-org-superhost-progress', orgSlug, orgId);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: OrgSuperhostProgressDto;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? 'Could not load Superhost progress');
      }
      return json.data;
    },
    staleTime: 60_000,
  });
}
