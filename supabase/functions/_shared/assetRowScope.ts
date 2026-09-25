/**
 * Row-level tenant check for property/parking-scoped tables that are addressed by a bare id
 * (finance line items, maintenance items). The handler authorizes the caller for a property or
 * parking; this proves the targeted row actually lives there, so one tenant can never read,
 * edit, delete or extend another tenant's row by guessing its id or recurrence series id.
 */

import { EdgeError } from './httpResponse.ts';
import { createServiceClient } from './orgAuth.ts';

export type AssetRowScope = { propertyId?: string | null; parkingId?: string | null };

type ScopedAssetTable = 'finance_line_items' | 'maintenance_items';

/** Throws a 404 (never 403, so foreign ids are not enumerable) unless the row is in scope. */
export async function assertAssetRowInScope(options: {
  table: ScopedAssetTable;
  scope: AssetRowScope;
  id?: string;
  recurrenceSeriesId?: string;
}): Promise<void> {
  const { table, scope, id, recurrenceSeriesId } = options;
  const notFound = new EdgeError(404, 'Entry not found', 'asset_row_not_found');
  if ((!scope.propertyId && !scope.parkingId) || (!id && !recurrenceSeriesId)) throw notFound;

  const { data, error } = await createServiceClient()
    .from(table)
    .select('id')
    .eq(id ? 'id' : 'recurrence_series_id', (id ?? recurrenceSeriesId) as string)
    .eq(scope.parkingId ? 'parking_id' : 'property_id', (scope.parkingId ?? scope.propertyId) as string)
    .limit(1);
  if (error) throw new Error(`${table} scope check failed: ${error.message}`);
  if (!data || data.length === 0) throw notFound;
}
