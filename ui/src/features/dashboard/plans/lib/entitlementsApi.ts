import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import type { PropertyEntitlements } from '@/features/dashboard/plans/lib/planFeatures';

import { supabase } from '@/lib/supabase/client';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return { Authorization: `Bearer ${token}` };
}

export async function fetchPropertyEntitlements(propertyId: string): Promise<PropertyEntitlements> {
  const res = await fetch(scopedFunctionsUrl('/property-entitlements', propertyId), {
    headers: await authHeaders(),
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: PropertyEntitlements;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to load entitlements');
  }
  return json.data;
}
