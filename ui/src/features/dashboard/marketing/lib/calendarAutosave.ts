import type { MarketingTemplateRecord } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { effectiveTemplateThemeKey } from '@/features/dashboard/marketing/lib/theme/marketingThemeItems';
import {
  calendarFormatToAspectPreset,
  type CalendarCanvasFormat,
} from '@/features/dashboard/marketing/lib/calendarCanvasFormats';

export const CALENDAR_LEGACY_AUTOSAVE_GROUP = '__legacy__';
export const CALENDAR_BLANK_PRESET_ID = 'default';
export const CALENDAR_CUSTOM_PRESET_ID = 'custom';

export function isCalendarBlankPreset(presetId: string | null | undefined): boolean {
  return presetId === CALENDAR_BLANK_PRESET_ID;
}

export function isCalendarCustomPreset(presetId: string | null | undefined): boolean {
  return presetId === CALENDAR_CUSTOM_PRESET_ID;
}

/** Designer presets autosave per preset+format; blank does not; saved custom templates autosave by row id. */
export function isCalendarPresetAutosave(presetId: string | null | undefined): boolean {
  if (!presetId) return false;
  return !isCalendarBlankPreset(presetId) && !isCalendarCustomPreset(presetId);
}

export function readCalendarSourcePreset(
  designJson: Record<string, unknown> | undefined
): string | null {
  const value = designJson?.sourcePresetId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function calendarAutosaveGroupKey(
  sourcePresetId: string | null | undefined,
  aspectPreset: string | null | undefined
): string {
  const preset = sourcePresetId?.trim() || CALENDAR_LEGACY_AUTOSAVE_GROUP;
  const aspect = aspectPreset?.trim() || 'instagram-post';
  return `${preset}:${aspect}`;
}

export function aspectPresetForCalendarFormat(format: CalendarCanvasFormat): string {
  return calendarFormatToAspectPreset(format);
}

export function calendarTemplateMatchesAspectPreset(
  aspectPreset: string | null | undefined,
  format: CalendarCanvasFormat
): boolean {
  return (aspectPreset?.trim() || 'instagram-post') === aspectPresetForCalendarFormat(format);
}

export function findCalendarAutosaveTemplate(
  templates: MarketingTemplateRecord[],
  sourcePresetId: string,
  aspectPreset: string
): MarketingTemplateRecord | undefined {
  const key = calendarAutosaveGroupKey(sourcePresetId, aspectPreset);
  return templates.find((template) => {
    if (template.contentType !== 'calendar') return false;
    return (
      calendarAutosaveGroupKey(
        readCalendarSourcePreset(template.designJson),
        template.aspectPreset
      ) === key
    );
  });
}

/** Rows without a preset key cannot be shown in the sidebar — remove after dedupe. */
export function planCalendarOrphanCleanup(templates: MarketingTemplateRecord[]): string[] {
  return templates
    .filter(
      (template) =>
        template.contentType === 'calendar' && !readCalendarSourcePreset(template.designJson)
    )
    .map((template) => template.id);
}

/** Autosaved blank/default rows should not exist — remove them. */
export function planCalendarDefaultAutosaveCleanup(templates: MarketingTemplateRecord[]): string[] {
  return templates
    .filter(
      (template) =>
        template.contentType === 'calendar' &&
        isCalendarBlankPreset(readCalendarSourcePreset(template.designJson))
    )
    .map((template) => template.id);
}

/**
 * Related custom calendar rows (Square / Portrait / Landscape) for remove/rename.
 * Prefers `aiGenerationId`, then legacy AI token match, then same custom name.
 */
export function planCalendarRelatedCustomIds(
  templates: MarketingTemplateRecord[],
  targetId: string
): string[] {
  const target = templates.find(
    (template) => template.id === targetId && template.contentType === 'calendar'
  );
  if (!target) return [targetId];

  const designJson = target.designJson ?? {};
  const generationId =
    typeof designJson.aiGenerationId === 'string' && designJson.aiGenerationId.trim()
      ? designJson.aiGenerationId.trim()
      : null;
  const aiGenerated = designJson.aiGenerated === true;
  const targetIsCustom = isCalendarCustomPreset(readCalendarSourcePreset(designJson));
  // Format siblings never cross themes: the same name can exist in two themes.
  const targetTheme = effectiveTemplateThemeKey(target);
  const sameTheme = (template: MarketingTemplateRecord) =>
    effectiveTemplateThemeKey(template) === targetTheme;

  if (generationId || aiGenerated) {
    const targetTokens = JSON.stringify(designJson.aiTokens ?? null);
    const related = templates.filter((template) => {
      if (template.contentType !== 'calendar' || !sameTheme(template)) return false;
      const json = template.designJson ?? {};
      if (generationId) {
        return (
          typeof json.aiGenerationId === 'string' && json.aiGenerationId.trim() === generationId
        );
      }
      if (json.aiGenerated !== true) return false;
      if (template.name !== target.name) return false;
      if (!isCalendarCustomPreset(readCalendarSourcePreset(json))) return false;
      return JSON.stringify(json.aiTokens ?? null) === targetTokens;
    });
    const ids = related.map((template) => template.id);
    if (ids.length > 0) return [...new Set(ids)];
  }

  if (targetIsCustom && target.name.trim()) {
    const sameName = templates.filter((template) => {
      if (template.contentType !== 'calendar' || !sameTheme(template)) return false;
      if (template.name !== target.name) return false;
      return isCalendarCustomPreset(readCalendarSourcePreset(template.designJson));
    });
    const ids = sameName.map((template) => template.id);
    if (ids.length > 0) return [...new Set(ids)];
  }

  return [targetId];
}

/** @see planCalendarRelatedCustomIds */
export function planCalendarRelatedCustomRemoval(
  templates: MarketingTemplateRecord[],
  targetId: string
): string[] {
  return planCalendarRelatedCustomIds(templates, targetId);
}

/**
 * Keep the newest row per theme + preset + format group; return ids to delete.
 * Theme is part of the key: the same look edited in two themes is two items.
 */
export function planCalendarTemplateDedupe(templates: MarketingTemplateRecord[]): string[] {
  const calendarTemplates = templates.filter((template) => template.contentType === 'calendar');
  const groups = new Map<string, MarketingTemplateRecord[]>();

  for (const template of calendarTemplates) {
    const sourcePreset = readCalendarSourcePreset(template.designJson);
    if (isCalendarCustomPreset(sourcePreset) || isCalendarBlankPreset(sourcePreset)) continue;

    const key = `${effectiveTemplateThemeKey(template)}|${calendarAutosaveGroupKey(
      sourcePreset,
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
