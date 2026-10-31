import { useCallback, useMemo, useState } from 'react';

import {
  CAMPAIGN_CATEGORY_LABELS,
  type CampaignCategory,
} from '@/features/dashboard/marketing/lib/designCanvasTypes';
import { isHiddenCategoryId } from '@/features/dashboard/marketing/lib/marketingCatalogHidden';
import {
  VIDEO_CATEGORIES,
  VIDEO_CATEGORY_LABELS,
  type VideoCategory,
} from '@/features/dashboard/marketing/lib/video/videoCategories';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export type MarketingCatalogTab = 'design' | 'video' | 'calendar';

export type CustomCategory = {
  id: string;
  label: string;
};

export type MarketingCatalogPrefs = {
  customCategories: CustomCategory[];
  hiddenBuiltinCategories: string[];
  hiddenBuiltinTemplates: string[];
  hiddenSavedTemplateIds: string[];
  categoryLabels: Record<string, string>;
  templateLabels: Record<string, string>;
  /** Preset template id → category id override (Move). */
  presetTemplateCategories: Record<string, string>;
  /** Calendar: hidden preset category section labels. */
  hiddenCalendarCategoryLabels: string[];
  /** Calendar: hidden individual preset values. */
  hiddenCalendarPresets: string[];
  /** Calendar: hidden saved template ids. */
  hiddenCalendarSavedTemplateIds: string[];
};

const DESIGN_BUILTIN_CATEGORIES: CampaignCategory[] = [
  'promo',
  'slots',
  'giveaway',
  'fully-booked',
  'reviews',
];

function builtinCategoriesForTab(tab: MarketingCatalogTab): string[] {
  if (tab === 'video') return [...VIDEO_CATEGORIES];
  return [...DESIGN_BUILTIN_CATEGORIES];
}

function builtinLabel(tab: MarketingCatalogTab, id: string): string {
  if (tab === 'video') {
    return VIDEO_CATEGORY_LABELS[id as VideoCategory] ?? id;
  }
  return CAMPAIGN_CATEGORY_LABELS[id as CampaignCategory] ?? id;
}

const EMPTY_PREFS: MarketingCatalogPrefs = {
  customCategories: [],
  hiddenBuiltinCategories: [],
  hiddenBuiltinTemplates: [],
  hiddenSavedTemplateIds: [],
  categoryLabels: {},
  templateLabels: {},
  presetTemplateCategories: {},
  hiddenCalendarCategoryLabels: [],
  hiddenCalendarPresets: [],
  hiddenCalendarSavedTemplateIds: [],
};

function storageKey(propertyId: string | null, tab: MarketingCatalogTab) {
  return `marketing-catalog:${propertyId ?? 'default'}:${tab}`;
}

function loadPrefs(propertyId: string | null, tab: MarketingCatalogTab): MarketingCatalogPrefs {
  if (typeof window === 'undefined') return EMPTY_PREFS;
  try {
    const raw = window.localStorage.getItem(storageKey(propertyId, tab));
    if (!raw) return EMPTY_PREFS;
    const parsed = JSON.parse(raw) as Partial<MarketingCatalogPrefs>;
    return {
      customCategories: parsed.customCategories ?? [],
      hiddenBuiltinCategories: parsed.hiddenBuiltinCategories ?? [],
      hiddenBuiltinTemplates: parsed.hiddenBuiltinTemplates ?? [],
      hiddenSavedTemplateIds: parsed.hiddenSavedTemplateIds ?? [],
      categoryLabels: parsed.categoryLabels ?? {},
      templateLabels: parsed.templateLabels ?? {},
      presetTemplateCategories: parsed.presetTemplateCategories ?? {},
      hiddenCalendarCategoryLabels: parsed.hiddenCalendarCategoryLabels ?? [],
      hiddenCalendarPresets: parsed.hiddenCalendarPresets ?? [],
      hiddenCalendarSavedTemplateIds: parsed.hiddenCalendarSavedTemplateIds ?? [],
    };
  } catch {
    return EMPTY_PREFS;
  }
}

function savePrefs(
  propertyId: string | null,
  tab: MarketingCatalogTab,
  prefs: MarketingCatalogPrefs
) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(propertyId, tab), JSON.stringify(prefs));
}

export type MarketingCategoryItem = {
  id: string;
  label: string;
  kind: 'builtin' | 'custom';
};

export function useMarketingCatalog(tab: MarketingCatalogTab) {
  const propertyId = usePropertyIdParam();
  const [prefs, setPrefs] = useState(() => loadPrefs(propertyId, tab));

  const persist = useCallback(
    (next: MarketingCatalogPrefs) => {
      setPrefs(next);
      savePrefs(propertyId, tab, next);
    },
    [propertyId, tab]
  );

  const categories = useMemo<MarketingCategoryItem[]>(() => {
    const builtIn = builtinCategoriesForTab(tab).map((id) => ({
      id,
      label: prefs.categoryLabels[id] ?? builtinLabel(tab, id),
      kind: 'builtin' as const,
    }));
    const custom = prefs.customCategories.map((item) => ({
      id: item.id,
      label: item.label,
      kind: 'custom' as const,
    }));
    return [...builtIn, ...custom];
  }, [prefs, tab]);

  const movableCategories = categories;

  const getTemplateLabel = useCallback(
    (templateId: string, fallback: string) => prefs.templateLabels[templateId] ?? fallback,
    [prefs.templateLabels]
  );

  const addCategory = useCallback(
    (label: string) => {
      const trimmed = label.trim();
      if (!trimmed) return null;
      const item: CustomCategory = {
        id: `custom-${crypto.randomUUID().slice(0, 8)}`,
        label: trimmed,
      };
      persist({ ...prefs, customCategories: [...prefs.customCategories, item] });
      return item.id;
    },
    [prefs, persist]
  );

  /** Reuse an existing category with this label (any case), else create one. */
  const findOrCreateCategoryByLabel = useCallback(
    (label: string) => {
      const trimmed = label.trim();
      if (!trimmed) return null;
      const existing = categories.find(
        (item) => item.label.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) return existing.id;
      return addCategory(trimmed);
    },
    [categories, addCategory]
  );

  const renameCategory = useCallback(
    (categoryId: string, label: string) => {
      if (isHiddenCategoryId(categoryId)) return;
      const trimmed = label.trim();
      if (!trimmed) return;
      const builtin = builtinCategoriesForTab(tab).find((id) => id === categoryId);
      if (builtin) {
        persist({
          ...prefs,
          categoryLabels: { ...prefs.categoryLabels, [builtin]: trimmed },
        });
        return;
      }
      persist({
        ...prefs,
        customCategories: prefs.customCategories.map((item) =>
          item.id === categoryId ? { ...item, label: trimmed } : item
        ),
      });
    },
    [prefs, persist, tab]
  );

  const deleteCategory = useCallback(
    (categoryId: string) => {
      persist({
        ...prefs,
        customCategories: prefs.customCategories.filter((item) => item.id !== categoryId),
      });
    },
    [prefs, persist]
  );

  const renamePresetTemplate = useCallback(
    (templateId: string, label: string) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      persist({
        ...prefs,
        templateLabels: { ...prefs.templateLabels, [templateId]: trimmed },
      });
    },
    [prefs, persist]
  );

  const getPresetCategory = useCallback(
    (templateId: string, defaultCategory: string) => {
      const override = prefs.presetTemplateCategories[templateId];
      if (override && movableCategories.some((item) => item.id === override)) {
        return override;
      }
      return defaultCategory;
    },
    [prefs.presetTemplateCategories, movableCategories]
  );

  const movePresetTemplate = useCallback(
    (templateId: string, targetCategoryId: string) => {
      if (isHiddenCategoryId(targetCategoryId)) return;
      if (!movableCategories.some((item) => item.id === targetCategoryId)) return;
      persist({
        ...prefs,
        presetTemplateCategories: {
          ...prefs.presetTemplateCategories,
          [templateId]: targetCategoryId,
        },
      });
    },
    [prefs, persist, movableCategories]
  );

  const hideCalendarCategory = useCallback(
    (categoryLabel: string) => {
      const trimmed = categoryLabel.trim();
      if (!trimmed || prefs.hiddenCalendarCategoryLabels.includes(trimmed)) return;
      persist({
        ...prefs,
        hiddenCalendarCategoryLabels: [...prefs.hiddenCalendarCategoryLabels, trimmed],
      });
    },
    [prefs, persist]
  );

  const unhideCalendarCategory = useCallback(
    (categoryLabel: string) => {
      persist({
        ...prefs,
        hiddenCalendarCategoryLabels: prefs.hiddenCalendarCategoryLabels.filter(
          (label) => label !== categoryLabel
        ),
      });
    },
    [prefs, persist]
  );

  const isCalendarCategoryHidden = useCallback(
    (categoryLabel: string) => prefs.hiddenCalendarCategoryLabels.includes(categoryLabel),
    [prefs.hiddenCalendarCategoryLabels]
  );

  const hideCalendarPreset = useCallback(
    (presetValue: string) => {
      if (prefs.hiddenCalendarPresets.includes(presetValue)) return;
      persist({
        ...prefs,
        hiddenCalendarPresets: [...prefs.hiddenCalendarPresets, presetValue],
      });
    },
    [prefs, persist]
  );

  const unhideCalendarPreset = useCallback(
    (presetValue: string) => {
      persist({
        ...prefs,
        hiddenCalendarPresets: prefs.hiddenCalendarPresets.filter((value) => value !== presetValue),
      });
    },
    [prefs, persist]
  );

  const isCalendarPresetHidden = useCallback(
    (presetValue: string) => prefs.hiddenCalendarPresets.includes(presetValue),
    [prefs.hiddenCalendarPresets]
  );

  const hideCalendarSavedTemplate = useCallback(
    (templateId: string) => {
      if (prefs.hiddenCalendarSavedTemplateIds.includes(templateId)) return;
      persist({
        ...prefs,
        hiddenCalendarSavedTemplateIds: [...prefs.hiddenCalendarSavedTemplateIds, templateId],
      });
    },
    [prefs, persist]
  );

  const unhideCalendarSavedTemplate = useCallback(
    (templateId: string) => {
      persist({
        ...prefs,
        hiddenCalendarSavedTemplateIds: prefs.hiddenCalendarSavedTemplateIds.filter(
          (id) => id !== templateId
        ),
      });
    },
    [prefs, persist]
  );

  const isCalendarSavedTemplateHidden = useCallback(
    (templateId: string) => prefs.hiddenCalendarSavedTemplateIds.includes(templateId),
    [prefs.hiddenCalendarSavedTemplateIds]
  );

  const resetCategoryLabel = useCallback(
    (categoryId: string) => {
      const next = { ...prefs.categoryLabels };
      delete next[categoryId];
      persist({ ...prefs, categoryLabels: next });
    },
    [prefs, persist]
  );

  const resetTemplateLabel = useCallback(
    (templateId: string) => {
      const next = { ...prefs.templateLabels };
      delete next[templateId];
      persist({ ...prefs, templateLabels: next });
    },
    [prefs, persist]
  );

  const isBuiltinCategory = useCallback(
    (categoryId: string) => builtinCategoriesForTab(tab).includes(categoryId),
    [tab]
  );

  return {
    categories,
    movableCategories,
    prefs,
    getTemplateLabel,
    getPresetCategory,
    addCategory,
    findOrCreateCategoryByLabel,
    renameCategory,
    deleteCategory,
    renamePresetTemplate,
    movePresetTemplate,
    hideCalendarCategory,
    unhideCalendarCategory,
    isCalendarCategoryHidden,
    hideCalendarPreset,
    unhideCalendarPreset,
    isCalendarPresetHidden,
    hideCalendarSavedTemplate,
    unhideCalendarSavedTemplate,
    isCalendarSavedTemplateHidden,
    resetCategoryLabel,
    resetTemplateLabel,
    isBuiltinCategory,
  };
}
