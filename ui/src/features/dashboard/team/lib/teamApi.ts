import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { scopedParkingFunctionsBaseUrl } from '@/features/dashboard/org/lib/adminParkingScope';
import {
  parseTeamApiData,
  parseTeamApiLooseData,
  parseTeamApiMutateData,
} from '@/features/dashboard/team/lib/teamApiJson';

import { supabase } from '@/lib/supabase/client';

export async function teamAuthHeaders(): Promise<HeadersInit> {
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

export async function teamGet<T>(path: string, propertyId: string): Promise<T> {
  const headers = await teamAuthHeaders();
  const res = await fetch(scopedFunctionsUrl(path, propertyId), { headers });
  return parseTeamApiData<T>(res);
}

export async function teamMutate<T>(
  path: string,
  propertyId: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>
): Promise<T> {
  const headers = await teamAuthHeaders();
  const payload = { propertyId, ...body };
  const res = await fetch(scopedFunctionsUrl(path, propertyId), {
    method,
    headers,
    body: JSON.stringify(payload),
  });
  return parseTeamApiMutateData<T>(res);
}

export async function teamGetParking<T>(path: string, parkingId: string): Promise<T> {
  const headers = await teamAuthHeaders();
  const res = await fetch(scopedParkingFunctionsBaseUrl(path, parkingId), { headers });
  return parseTeamApiData<T>(res);
}

export async function teamMutateParking<T>(
  path: string,
  parkingId: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>
): Promise<T> {
  const headers = await teamAuthHeaders();
  const payload = { parkingId, ...body };
  const res = await fetch(scopedParkingFunctionsBaseUrl(path, parkingId), {
    method,
    headers,
    body: JSON.stringify(payload),
  });
  return parseTeamApiLooseData<T>(res);
}
