/**
 * Helpers for scheduled jobs that iterate per property.
 */

import { createServiceClient } from './orgAuth.ts';

export async function listAllPropertyIds(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[propertyCron] list properties:', error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => (row.id as string | null)?.trim())
    .filter((id): id is string => !!id);
}

export async function listAllParkingIds(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('parkings')
    .select('id')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[propertyCron] list parkings:', error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => (row.id as string | null)?.trim())
    .filter((id): id is string => !!id);
}

export function propertyIdFromRow(row: Record<string, unknown>): string | undefined {
  const id = String(row.property_id ?? '').trim();
  return id || undefined;
}
