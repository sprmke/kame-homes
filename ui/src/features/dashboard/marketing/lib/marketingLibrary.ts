/**
 * Marketing Studio Library: sizes, labels, template catalogs and small formatting
 * helpers shared by the Library home, the template gallery and the editors.
 * Pure (no React, no editor engines) so the Library stays light.
 */

import type { MarketingContentType } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import {
  CALENDAR_PRESET_CATEGORIES,
  type CalendarPresetCategory,
} from '@/features/dashboard/marketing/lib/calendarPresetCatalog';
import {
  campaignTemplateBaseId,
  campaignTemplatesForFormat,
} from '@/features/dashboard/marketing/lib/designCampaignTemplates';
import {
  CAMPAIGN_CATEGORY_LABELS,
  type CampaignCategory,
} from '@/features/dashboard/marketing/lib/designCanvasTypes';
import type { MarketingTemplateRef } from '@/features/dashboard/marketing/lib/marketingStudioRoute';
import {
  DESIGN_FORMAT_DIMENSIONS,
  type DesignTemplateFormat,
} from '@/features/dashboard/marketing/lib/templateRegistry';
import {
  VIDEO_CATEGORIES,
  VIDEO_CATEGORY_LABELS,
} from '@/features/dashboard/marketing/lib/video/videoCategories';
import { videoTemplatesForCategory } from '@/features/dashboard/marketing/lib/videoCampaignTemplates';

// ── Sizes ──────────────────────────────────────────────────────────────────

export type MarketingSizeOption = {
  /** Stored as `marketing_templates.aspect_preset` and the `?size=` param. */
  value: string;
  label: string;
  hint: string;
  width: number;
  height: number;
};

function designDims(format: DesignTemplateFormat) {
  const { width, height } = DESIGN_FORMAT_DIMENSIONS[format];
  return { width, height };
}

const DESIGN_SIZES: MarketingSizeOption[] = [
  {
    value: 'instagram-post',
    label: 'Square',
    hint: 'Feed post',
    ...designDims('instagram-post'),
  },
  {
    value: 'instagram-portrait',
    label: 'Portrait',
    hint: 'Feed post 4:5',
    ...designDims('instagram-portrait'),
  },
  {
    value: 'instagram-story',
    label: 'Story',
    hint: 'Stories',
    ...designDims('instagram-story'),
  },
  {
    value: 'facebook-post',
    label: 'Facebook',
    hint: 'Page post',
    ...designDims('facebook-post'),
  },
];

const VIDEO_SIZES: MarketingSizeOption[] = [
  {
    value: 'instagram-story',
    label: 'Story',
    hint: 'Reels and Stories',
    width: 1080,
    height: 1920,
  },
  { value: 'instagram-post', label: 'Square', hint: 'Feed video', width: 1080, height: 1080 },
  { value: 'landscape', label: 'Landscape', hint: 'Facebook and web', width: 1920, height: 1080 },
];

const CALENDAR_SIZES: MarketingSizeOption[] = [
  { value: 'instagram-post', label: 'Square', hint: 'Feed post', width: 1080, height: 1080 },
  { value: 'instagram-story', label: 'Portrait', hint: 'Stories', width: 1080, height: 1920 },
  { value: 'landscape', label: 'Landscape', hint: 'Facebook and web', width: 1920, height: 1080 },
];

export const MARKETING_SIZES: Record<MarketingContentType, MarketingSizeOption[]> = {
  design: DESIGN_SIZES,
  video: VIDEO_SIZES,
  calendar: CALENDAR_SIZES,
};

/** Sizes a new design can start in (posts: the preset library has no 4:5 layouts). */
export function startSizesFor(contentType: MarketingContentType): MarketingSizeOption[] {
  if (contentType === 'design') {
    return DESIGN_SIZES.filter((size) => size.value !== 'instagram-portrait');
  }
  return MARKETING_SIZES[contentType];
}

export function defaultSizeFor(contentType: MarketingContentType): string {
  return contentType === 'video' ? 'instagram-story' : 'instagram-post';
}

export function sizeOption(
  contentType: MarketingContentType,
  value: string | null | undefined
): MarketingSizeOption | null {
  return MARKETING_SIZES[contentType].find((size) => size.value === value) ?? null;
}

export function sizeLabel(contentType: MarketingContentType, value: string | null | undefined) {
  return sizeOption(contentType, value)?.label ?? 'Custom size';
}

/** A valid start size for this content type (falls back to the default). */
export function normalizeStartSize(
  contentType: MarketingContentType,
  value: string | null | undefined
): string {
  const sizes = contentType === 'design' ? DESIGN_SIZES : MARKETING_SIZES[contentType];
  return sizes.some((size) => size.value === value) ? value! : defaultSizeFor(contentType);
}

// ── Names ──────────────────────────────────────────────────────────────────

const MAX_NAME_LENGTH = 120;

/** Same rules as the edge: collapse spaces, trim, cap length. Null when empty. */
export function normalizeDesignName(value: string): string | null {
  const name = value.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim();
  return name || null;
}

export const CONTENT_NOUN: Record<MarketingContentType, { one: string; many: string }> = {
  design: { one: 'post', many: 'posts' },
  video: { one: 'video', many: 'videos' },
  calendar: { one: 'calendar', many: 'calendars' },
};

export const BLANK_NAME: Record<MarketingContentType, string> = {
  design: 'Untitled post',
  video: 'Untitled video',
  calendar: 'Untitled calendar',
};

const CALENDAR_NAME_SUFFIX = ' calendar';

/**
 * Default name for a new calendar in a theme.
 * "Desk Buddy" → "Desk Buddy calendar". A theme already called "… calendar" stays as it is.
 */
export function calendarNameFromTheme(themeName: string): string {
  const name = themeName.replace(/\s+/g, ' ').trim();
  if (!name) return 'Calendar';
  if (/\bcalendars?$/i.test(name)) return name.slice(0, MAX_NAME_LENGTH).trim();
  const room = MAX_NAME_LENGTH - CALENDAR_NAME_SUFFIX.length;
  const stem = name.length <= room ? name : name.slice(0, room).trimEnd();
  return `${stem}${CALENDAR_NAME_SUFFIX}`;
}

/**
 * First free name in a list: "Desk Buddy calendar", then "Desk Buddy calendar 2".
 * Same pattern as a new folder on macOS and as theme names in this studio.
 * " (copy)" stays reserved for Duplicate.
 */
export function nextSequencedName(base: string, taken: readonly string[]): string {
  const stem = base.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim() || 'Calendar';
  const lower = new Set(taken.map((name) => name.replace(/\s+/g, ' ').trim().toLowerCase()));
  if (!lower.has(stem.toLowerCase())) return stem;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${stem} ${n}`.slice(0, MAX_NAME_LENGTH);
    if (candidate === stem) break;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
  return `${stem} ${Date.now() % 1000}`.slice(0, MAX_NAME_LENGTH);
}

// ── Edited time (Asia/Manila) ──────────────────────────────────────────────

const TIME_ZONE = 'Asia/Manila';

function manilaDayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date);
}

/** "Just now", "5m ago", "3h ago", "Yesterday", "Mon", "Oct 2", "Oct 2, 2025". */
export function formatEditedAt(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const time = date.getTime();
  if (Number.isNaN(time)) return '';
  const diff = now.getTime() - time;
  if (diff < 60_000) return 'Just now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  const today = manilaDayKey(now);
  if (manilaDayKey(date) === today) return `${Math.floor(diff / (60 * 60_000))}h ago`;
  const yesterday = manilaDayKey(new Date(now.getTime() - 24 * 60 * 60_000));
  if (manilaDayKey(date) === yesterday) return 'Yesterday';
  if (diff < 6 * 24 * 60 * 60_000) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TIME_ZONE }).format(date);
  }
  const sameYear =
    new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: TIME_ZONE }).format(date) ===
    new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: TIME_ZONE }).format(now);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: TIME_ZONE,
  }).format(date);
}

/** Days left before a Recently deleted item is gone for good. */
export function daysUntilPurge(deletedAt: string, now: Date = new Date(), windowDays = 30) {
  const deleted = new Date(deletedAt).getTime();
  if (Number.isNaN(deleted)) return windowDays;
  const left = windowDays - Math.floor((now.getTime() - deleted) / (24 * 60 * 60_000));
  return Math.max(0, Math.min(windowDays, left));
}

// ── Template catalogs (gallery + Start new) ────────────────────────────────

export type MarketingGalleryTemplate = {
  /** Stable key + where a draft starts from. */
  ref: MarketingTemplateRef;
  /** `source_template_id` form, for "Used 2x". */
  sourceId: string;
  name: string;
  categoryId: string;
  /** Concrete preset id for this size (posts have one per size). */
  presetId: string;
  description?: string;
  swatch: { primary: string; secondary?: string };
};

export type MarketingGalleryCategory = {
  id: string;
  label: string;
  templates: MarketingGalleryTemplate[];
};

const DESIGN_CATEGORY_ORDER: CampaignCategory[] = [
  'promo',
  'slots',
  'giveaway',
  'fully-booked',
  'reviews',
];

function designCatalog(size: string): MarketingGalleryCategory[] {
  const format = (
    DESIGN_SIZES.some((option) => option.value === size) ? size : 'instagram-post'
  ) as DesignTemplateFormat;
  return DESIGN_CATEGORY_ORDER.map((category) => ({
    id: category,
    label: CAMPAIGN_CATEGORY_LABELS[category],
    templates: campaignTemplatesForFormat(format, category).map((template) => {
      const baseId = campaignTemplateBaseId(template.id);
      return {
        ref: { kind: 'preset', id: baseId } as const,
        sourceId: `preset:${baseId}`,
        name: template.name,
        categoryId: category,
        presetId: template.id,
        swatch: { primary: template.preview.primary, secondary: template.preview.secondary },
      };
    }),
  })).filter((category) => category.templates.length > 0);
}

function videoCatalog(): MarketingGalleryCategory[] {
  return VIDEO_CATEGORIES.map((category) => ({
    id: category,
    label: VIDEO_CATEGORY_LABELS[category],
    templates: videoTemplatesForCategory(category).map((template) => ({
      ref: { kind: 'preset', id: template.id } as const,
      sourceId: `preset:${template.id}`,
      name: template.name,
      categoryId: category,
      presetId: template.id,
      swatch: { primary: template.presetAccent ?? '#1f2937', secondary: '#fff7eb' },
    })),
  })).filter((category) => category.templates.length > 0);
}

function calendarCatalog(categories: CalendarPresetCategory[]): MarketingGalleryCategory[] {
  return categories.map((category) => ({
    id: category.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label: category.label,
    templates: category.presets.map((preset) => ({
      ref: { kind: 'preset', id: preset.value } as const,
      sourceId: `preset:${preset.value}`,
      name: preset.label,
      categoryId: category.label,
      presetId: preset.value,
      description: preset.description,
      swatch: { primary: preset.color, secondary: preset.secondary },
    })),
  }));
}

/** Built-in templates for a content type at a size, grouped by category. */
export function builtinTemplateCatalog(
  contentType: MarketingContentType,
  size: string
): MarketingGalleryCategory[] {
  if (contentType === 'design') return designCatalog(size);
  if (contentType === 'video') return videoCatalog();
  return calendarCatalog(CALENDAR_PRESET_CATEGORIES);
}

/** Every built-in template once (no categories), in catalog order. */
export function flatTemplates(categories: MarketingGalleryCategory[]): MarketingGalleryTemplate[] {
  return categories.flatMap((category) => category.templates);
}

/** Case-insensitive name / category match for the gallery search box. */
export function filterTemplates(
  templates: MarketingGalleryTemplate[],
  query: string,
  categoryLabels: Record<string, string> = {}
): MarketingGalleryTemplate[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return templates;
  return templates.filter((template) =>
    [template.name, template.description ?? '', categoryLabels[template.categoryId] ?? '']
      .join(' ')
      .toLowerCase()
      .includes(needle)
  );
}

/** Concrete Polotno preset id for a post template at a size (`promo-500-off-instagram-story`). */
export function designPresetIdForSize(baseId: string, size: string): string {
  return `${baseId}-${size}`;
}
