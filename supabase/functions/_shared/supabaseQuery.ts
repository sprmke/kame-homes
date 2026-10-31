import type { SupabaseClient } from './supabaseJs.ts';

type FilterQuery = {
  eq: (column: string, value: string | number) => FilterQuery;
};

export type AssetDbScope = {
  propertyId?: string | null;
  parkingId?: string | null;
};

export function applyAssetScopeFilter<T extends FilterQuery>(
  query: T,
  scope?: AssetDbScope | null,
  legacyId = 1
): T {
  if (scope?.parkingId) {
    return query.eq('parking_id', scope.parkingId) as T;
  }
  if (scope?.propertyId) {
    return query.eq('property_id', scope.propertyId) as T;
  }
  return query.eq('id', legacyId) as T;
}

export function applyPropertyOrLegacySingletonFilter<T extends FilterQuery>(
  query: T,
  propertyId?: string | null,
  legacyId = 1
): T {
  return applyAssetScopeFilter(query, propertyId ? { propertyId } : null, legacyId);
}

export type RpcObjectResult<T extends Record<string, unknown>> =
  | { ok: false; error: string }
  | T;

export async function callRpcObject<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown> | undefined,
  logLabel: string
): Promise<RpcObjectResult<T>> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(logLabel, error);
    return { ok: false, error: error.message ?? 'rpc failed' };
  }
  if (data && typeof data === 'object' && data !== null) {
    return data as T;
  }
  return { ok: false, error: 'unexpected rpc response' };
}

type UpdateQuery = FilterQuery & {
  update: (values: Record<string, unknown>) => UpdateQuery;
  select: () => UpdateQuery;
  single: () => Promise<{
    data: Record<string, unknown> | null;
    error: { message?: string } | null;
  }>;
};

export async function updateAssetScopedSingleton(
  supabase: SupabaseClient,
  table: string,
  patch: Record<string, unknown>,
  scope: AssetDbScope | undefined,
  logLabel: string,
  errorMessage: string
): Promise<Record<string, unknown>> {
  let query = (supabase.from(table) as unknown as UpdateQuery).update({
    ...patch,
    updated_at: new Date().toISOString(),
  });
  query = applyAssetScopeFilter(query, scope) as UpdateQuery;
  const { data, error } = await query.select().single();

  if (error) {
    console.error(`${logLabel}:`, error);
    throw new Error(errorMessage);
  }
  if (!data) {
    throw new Error(errorMessage);
  }
  return data;
}

export async function updatePropertyScopedSingleton(
  supabase: SupabaseClient,
  table: string,
  patch: Record<string, unknown>,
  propertyId: string | undefined,
  logLabel: string,
  errorMessage: string
): Promise<Record<string, unknown>> {
  return updateAssetScopedSingleton(
    supabase,
    table,
    patch,
    propertyId ? { propertyId } : undefined,
    logLabel,
    errorMessage
  );
}
