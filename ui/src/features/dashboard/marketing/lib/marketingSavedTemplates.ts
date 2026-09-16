import type { MarketingTemplateRecord } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { readCollageSettings } from '@/features/dashboard/marketing/lib/collage/collageDocument';
import { isDesignCustomTemplate } from '@/features/dashboard/marketing/lib/designAutosave';
import { normalizeVideoCategory } from '@/features/dashboard/marketing/lib/video/videoCategories';

export { isDesignCustomTemplate } from '@/features/dashboard/marketing/lib/designAutosave';

export function marketingSavedTemplateCategoryId(
  record: MarketingTemplateRecord
): string | undefined {
  const categoryId = record.designJson.categoryId ?? record.designJson.category;
  return typeof categoryId === 'string' ? categoryId : undefined;
}

/** A saved design record whose canvas is a collage (`custom.collage` on the Polotno JSON). */
export function isSavedCollageTemplate(record: MarketingTemplateRecord): boolean {
  if (record.contentType !== 'design') return false;
  return readCollageSettings(record.designJson.polotno) != null;
}

/** Normalize a saved video row’s category into the Video-only catalog. */
export function marketingVideoSavedCategoryId(record: MarketingTemplateRecord): string | undefined {
  const raw = marketingSavedTemplateCategoryId(record);
  if (!raw) return undefined;
  return normalizeVideoCategory(raw);
}

export function marketingSavedTemplateAspect(record: MarketingTemplateRecord): string | null {
  if (record.aspectPreset) return record.aspectPreset;
  const format = record.designJson.format;
  return typeof format === 'string' ? format : null;
}

export function marketingSavedTemplateMatchesFormat(
  record: MarketingTemplateRecord,
  format: string
): boolean {
  const aspect = marketingSavedTemplateAspect(record);
  return !aspect || aspect === format;
}

/** Design sidebar: only explicit custom saves, not preset autosave rows. */
export function marketingDesignSidebarRecords(
  records: MarketingTemplateRecord[]
): MarketingTemplateRecord[] {
  return records.filter((record) => {
    if (record.contentType !== 'design') return true;
    return isDesignCustomTemplate(record);
  });
}

/**
 * Related saved rows (Instagram Post / Story / Facebook Post) for rename/move/archive/remove.
 * Groups by `aiGenerationId` so one AI generate’s three formats stay in sync.
 */
export function planSavedTemplateRelatedIds(
  templates: MarketingTemplateRecord[],
  targetId: string
): string[] {
  const target = templates.find((template) => template.id === targetId);
  if (!target) return [targetId];

  const generationId =
    typeof target.designJson.aiGenerationId === 'string' && target.designJson.aiGenerationId.trim()
      ? target.designJson.aiGenerationId.trim()
      : null;
  if (!generationId) return [targetId];

  const related = templates.filter((template) => {
    if (template.contentType !== target.contentType) return false;
    const value = template.designJson.aiGenerationId;
    return typeof value === 'string' && value.trim() === generationId;
  });
  const ids = related.map((template) => template.id);
  return ids.length > 0 ? [...new Set(ids)] : [targetId];
}
