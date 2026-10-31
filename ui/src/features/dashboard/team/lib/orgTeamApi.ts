import { scopedOrgFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import {
  parseTeamApiData,
  parseTeamApiMutateData,
} from '@/features/dashboard/team/lib/teamApiJson';

import { supabase } from '@/lib/supabase/client';

export async function orgTeamAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not signed in');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function orgTeamGet<T>(
  path: string,
  orgSlug: string | null,
  orgId: string | null
): Promise<T> {
  const headers = await orgTeamAuthHeaders();
  const res = await fetch(scopedOrgFunctionsUrl(path, orgSlug, orgId), { headers });
  return parseTeamApiData<T>(res);
}

export async function orgTeamMutate<T>(
  path: string,
  orgSlug: string | null,
  orgId: string | null,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>
): Promise<T> {
  const headers = await orgTeamAuthHeaders();
  const payload = { orgId, ...body };
  const res = await fetch(scopedOrgFunctionsUrl(path, orgSlug, orgId), {
    method,
    headers,
    body: JSON.stringify(payload),
  });
  return parseTeamApiMutateData<T>(res);
}
