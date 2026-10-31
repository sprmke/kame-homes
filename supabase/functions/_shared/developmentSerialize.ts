import type { SupabaseClient } from './supabaseJs.ts';
import { trimOrEmpty } from './stringUtils.ts';

export type DevelopmentRow = {
  id: string;
  slug: string;
  name: string;
  developer_name: string | null;
  type: string;
  status: string;
  location: string | null;
  city: string | null;
  description: string | null;
  cover_image_url: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DevelopmentListStats = {
  propertyCount: number;
  parkingCount: number;
};

export function serializeDevelopment(row: DevelopmentRow, stats?: DevelopmentListStats) {
  const settings = row.settings ?? {};
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    developerName: row.developer_name,
    type: row.type,
    status: row.status,
    location: row.location,
    city: row.city,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    settings,
    stats: stats ?? { propertyCount: 0, parkingCount: 0 },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function allocateDevelopmentSlug(
  supabase: SupabaseClient,
  name: string,
  preferred?: string,
  excludeDevelopmentId?: string
): Promise<string> {
  const { slugifyName, withSlugSuffix } = await import('./slugUtils.ts');
  const base = slugifyName(preferred?.trim() || name);
  for (let i = 0; i < 20; i++) {
    const candidate = withSlugSuffix(base, i);
    const { data } = await supabase
      .from('developments')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
    if (excludeDevelopmentId && data.id === excludeDevelopmentId) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function developmentStatsByName(
  supabase: SupabaseClient,
  names: string[]
): Promise<Map<string, DevelopmentListStats>> {
  const map = new Map<string, DevelopmentListStats>();
  if (names.length === 0) return map;

  for (const name of names) {
    map.set(name, { propertyCount: 0, parkingCount: 0 });
  }

  const [{ data: properties }, { data: parkings }] = await Promise.all([
    supabase.from('properties').select('residence_name').in('residence_name', names),
    supabase.from('parkings').select('residence_name').in('residence_name', names),
  ]);

  for (const row of properties ?? []) {
    const key = row.residence_name as string;
    const current = map.get(key);
    if (current) current.propertyCount += 1;
  }

  for (const row of parkings ?? []) {
    const key = row.residence_name as string;
    const current = map.get(key);
    if (current) current.parkingCount += 1;
  }

  return map;
}

export function readDevelopmentPmoEmail(
  settings: Record<string, unknown> | null | undefined
): string {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return '';
  const value = settings.pmoEmail;
  return typeof value === 'string' ? trimOrEmpty(value) : '';
}

export async function loadDevelopmentPmoEmailByName(
  supabase: SupabaseClient,
  developmentName: string
): Promise<string | null> {
  const name = trimOrEmpty(developmentName);
  if (!name) return null;

  const { data, error } = await supabase
    .from('developments')
    .select('settings')
    .eq('name', name)
    .maybeSingle();

  if (error) {
    console.warn('[developmentSerialize] pmoEmail load failed:', error.message);
    return null;
  }

  const email = readDevelopmentPmoEmail(data?.settings as Record<string, unknown> | undefined);
  return email || null;
}
