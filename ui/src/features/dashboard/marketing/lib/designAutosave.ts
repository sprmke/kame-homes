import { effectiveTemplateThemeKey } from '@/features/dashboard/marketing/lib/theme/marketingThemeItems';
import type { MarketingTemplateRecord } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { getCampaignTemplate } from '@/features/dashboard/marketing/lib/designCampaignTemplates';

export const DESIGN_CUSTOM_SOURCE_PRESET_ID = 'custom';

export function readDesignSourcePreset(
  designJson: Record<string, unknown> | undefined
): string | null {
  const value = designJson?.sourcePresetId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function readDesignTemplateId(
  designJson: Record<string, unknown> | undefined
): string | null {
  const value = designJson?.templateId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function isDesignCustomTemplate(record: MarketingTemplateRecord): boolean {
  if (record.contentType !== 'design') return false;

  const source = readDesignSourcePreset(record.designJson);
  if (source === DESIGN_CUSTOM_SOURCE_PRESET_ID) return true;

  const templateId = readDesignTemplateId(record.designJson);
  if (!templateId) return true;

  const preset = getCampaignTemplate(templateId);
  if (!preset) return true;

  // New autosave rows tag sourcePresetId with the preset id.
  if (source === templateId) return false;

  // Legacy rows (no sourcePresetId): treat as custom when the display name
  // does not match the built-in preset label (e.g. "My template").
  if (!source && record.name.trim() !== preset.name.trim()) return true;

  return false;
}

export function isDesignPresetAutosave(record: MarketingTemplateRecord): boolean {
  if (record.contentType !== 'design') return false;
  return !isDesignCustomTemplate(record);
}

export function designAutosaveGroupKey(
  templateId: string | null | undefined,
  aspectPreset: string | null | undefined
): string {
  const preset = templateId?.trim() || '__unknown__';
  const aspect = aspectPreset?.trim() || 'instagram-post';
  return `${preset}:${aspect}`;
}

export function findDesignAutosaveTemplate(
  templates: MarketingTemplateRecord[],
  templateId: string,
  aspectPreset: string
): MarketingTemplateRecord | undefined {
  const key = designAutosaveGroupKey(templateId, aspectPreset);
  return templates.find((template) => {
    if (!isDesignPresetAutosave(template)) return false;
    return (
      designAutosaveGroupKey(readDesignTemplateId(template.designJson), template.aspectPreset) ===
      key
    );
  });
}

/**
 * Keep the newest autosave per theme + preset + format; return ids to delete.
 * Theme is part of the key: the same preset edited in two themes is two items.
 */
export function planDesignTemplateDedupe(templates: MarketingTemplateRecord[]): string[] {
  const groups = new Map<string, MarketingTemplateRecord[]>();

  for (const template of templates) {
    if (!isDesignPresetAutosave(template)) continue;
    const key = `${effectiveTemplateThemeKey(template)}|${designAutosaveGroupKey(
      readDesignTemplateId(template.designJson),
      template.aspectPreset
    )}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(template);
    groups.set(key, bucket);
  }

  const removeIds: string[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length <= 1) continue;
    const sorted = [...bucket].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    for (const duplicate of sorted.slice(1)) {
      removeIds.push(duplicate.id);
    }
  }

  return removeIds;
}

/**
 * Clean up rows from the old infinite-save bug: extra autosaves of the same preset.
 * Keeps the newest per theme + preset + format (it used to delete every preset
 * autosave, and its done-flag is per browser, so a new device wiped real work).
 * Explicit custom saves are never touched.
 */
export function planDesignAutosavePurge(templates: MarketingTemplateRecord[]): string[] {
  return planDesignTemplateDedupe(templates);
}
