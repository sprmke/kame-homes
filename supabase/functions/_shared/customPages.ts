/**
 * Custom Pages — per-property template selection (stay_guide + property_showcase).
 * Rows are lazily created on first read, mirroring property_template_contents's default-fallback pattern.
 */

import { createClient } from './supabaseJs.ts';

export type CustomPageType = 'stay_guide' | 'property_showcase';

export const SHOWCASE_TEMPLATE_KEYS = [
  'showcase-aurora',
  'showcase-monolith',
  'showcase-editorial',
  'showcase-verso',
  'showcase-atlas',
  'showcase-haven',
] as const;

export type ShowcaseTemplateKey = (typeof SHOWCASE_TEMPLATE_KEYS)[number];

export const SHOWCASE_DEFAULT_TEMPLATE_KEY: ShowcaseTemplateKey = 'showcase-aurora';

/**
 * Stay Guide now reuses the same 6 animated templates as Property Showcase.
 * The pre-v2 default was `stay-guide-warm-arrival`; legacy rows normalize to Aurora on read
 * (and are backfilled by `20261210120300_stay_guide_template_keys.sql`).
 */
export const STAY_GUIDE_DEFAULT_TEMPLATE_KEY: ShowcaseTemplateKey = SHOWCASE_DEFAULT_TEMPLATE_KEY;

export type CustomPageRow = {
  id: string;
  propertyId: string;
  pageType: CustomPageType;
  templateKey: string;
  createdAt: string;
  updatedAt: string;
};

export function isShowcaseTemplateKey(value: unknown): value is ShowcaseTemplateKey {
  return typeof value === 'string' && (SHOWCASE_TEMPLATE_KEYS as readonly string[]).includes(value);
}

function defaultTemplateKeyFor(pageType: CustomPageType): string {
  switch (pageType) {
    case 'stay_guide':
      return STAY_GUIDE_DEFAULT_TEMPLATE_KEY;
    case 'property_showcase':
      return SHOWCASE_DEFAULT_TEMPLATE_KEY;
  }
}

function normalizeTemplateKey(_pageType: CustomPageType, templateKey: string): string {
  // Stay Guide + Showcase share the same 6 animated template keys.
  return isShowcaseTemplateKey(templateKey) ? templateKey : SHOWCASE_DEFAULT_TEMPLATE_KEY;
}

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

function toCustomPageRow(row: {
  id: string;
  property_id: string;
  page_type: string;
  template_key: string;
  created_at: string;
  updated_at: string;
}): CustomPageRow {
  return {
    id: row.id,
    propertyId: row.property_id,
    pageType: row.page_type as CustomPageType,
    templateKey: row.template_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function parseCustomPageType(value: unknown): CustomPageType | null {
  if (value === 'stay_guide' || value === 'property_showcase') return value;
  return null;
}

/** Get the property's custom_pages row for a page type, creating it with the default template on first read. */
export async function getOrCreateCustomPage(
  propertyId: string,
  pageType: CustomPageType
): Promise<CustomPageRow> {
  const supabase = supabaseAdmin();

  const { data: existing, error: readError } = await supabase
    .from('custom_pages')
    .select('*')
    .eq('property_id', propertyId)
    .eq('page_type', pageType)
    .maybeSingle();

  if (readError) {
    console.error('[customPages] getOrCreateCustomPage read:', readError);
    throw new Error('Failed to load custom page');
  }

  if (existing) return toCustomPageRow(existing);

  const { data: created, error: insertError } = await supabase
    .from('custom_pages')
    .insert({
      property_id: propertyId,
      page_type: pageType,
      template_key: defaultTemplateKeyFor(pageType),
    })
    .select('*')
    .single();

  if (insertError) {
    const { data: retried, error: retryError } = await supabase
      .from('custom_pages')
      .select('*')
      .eq('property_id', propertyId)
      .eq('page_type', pageType)
      .maybeSingle();

    if (retryError || !retried) {
      console.error('[customPages] getOrCreateCustomPage insert:', insertError);
      throw new Error('Failed to create custom page');
    }
    return toCustomPageRow(retried);
  }

  return toCustomPageRow(created);
}

export async function updateCustomPageTemplate(
  propertyId: string,
  pageType: CustomPageType,
  templateKey: string
): Promise<CustomPageRow> {
  const normalized = normalizeTemplateKey(pageType, templateKey);
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  await getOrCreateCustomPage(propertyId, pageType);

  const { data, error } = await supabase
    .from('custom_pages')
    .update({ template_key: normalized, updated_at: now })
    .eq('property_id', propertyId)
    .eq('page_type', pageType)
    .select('*')
    .single();

  if (error || !data) {
    console.error('[customPages] updateCustomPageTemplate:', error);
    throw new Error('Failed to update custom page template');
  }

  return toCustomPageRow(data);
}

/** Guest read — never inserts. Missing row → default template key. */
export async function getCustomPageTemplateOrDefault(
  propertyId: string,
  pageType: CustomPageType
): Promise<string> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('custom_pages')
    .select('template_key')
    .eq('property_id', propertyId)
    .eq('page_type', pageType)
    .maybeSingle();

  if (error) {
    console.error('[customPages] getCustomPageTemplateOrDefault:', error);
    return defaultTemplateKeyFor(pageType);
  }

  if (!data?.template_key) return defaultTemplateKeyFor(pageType);
  return normalizeTemplateKey(pageType, data.template_key);
}

/** Thin wrapper for the stay guide render path — the (normalized) template key. */
export async function resolveStayGuideTemplateKey(
  propertyId: string
): Promise<ShowcaseTemplateKey> {
  const row = await getOrCreateCustomPage(propertyId, 'stay_guide');
  return normalizeTemplateKey('stay_guide', row.templateKey) as ShowcaseTemplateKey;
}
