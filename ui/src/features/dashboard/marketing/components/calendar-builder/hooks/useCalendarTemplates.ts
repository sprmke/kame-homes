import { useCallback, useMemo } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useMarketingTemplates } from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { readCalendarSourcePreset } from '@/features/dashboard/marketing/lib/calendarAutosave';
import { themedSavedCalendarStyles } from '@/features/dashboard/marketing/lib/theme/calendarThemeAdapter';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { templatesInTheme } from '@/features/dashboard/marketing/lib/theme/marketingThemeItems';
import { usePropertyIdParam, scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

import type { CalendarStyles } from '../types';

export interface SavedCalendarTemplate {
  id: string;
  name: string;
  styles: CalendarStyles;
  sourcePresetId: string | null;
  aspectPreset: string | null;
  createdAt: string;
  thumbnailDataUrl?: string;
  aiGenerated?: boolean;
  aiGenerationId?: string | null;
  /** Paths set by hand in Advanced (kept when the theme changes). */
  lockedPaths: string[];
}

export type CalendarTemplatesThemeScope = {
  key: string;
  tokens: MarketingThemeTokens;
  propertyPhotoUrl?: string;
};

/**
 * Saved calendars for one theme. `apiTemplates` is scoped to the theme (so
 * autosave lookups and format siblings never cross themes) and `savedTemplates`
 * holds styles already re-expressed in the theme's current tokens.
 */
export function useCalendarTemplates(theme: CalendarTemplatesThemeScope | null) {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const { data: allCalendarTemplates } = useMarketingTemplates('calendar');
  const themeKey = theme?.key ?? null;
  const themeTokens = theme?.tokens ?? null;
  const themePhoto = theme?.propertyPhotoUrl;

  const apiTemplates = useMemo(() => {
    const rows = allCalendarTemplates ?? [];
    return themeKey ? templatesInTheme(rows, themeKey) : rows;
  }, [allCalendarTemplates, themeKey]);

  const savedTemplates = useMemo((): SavedCalendarTemplate[] => {
    const rows: SavedCalendarTemplate[] = [];
    for (const row of apiTemplates) {
      const rawStyles = row.designJson?.styles;
      if (!rawStyles || typeof rawStyles !== 'object') continue;
      const themed = themeTokens
        ? themedSavedCalendarStyles(row.designJson, rawStyles as CalendarStyles, themeTokens, themePhoto)
        : { styles: rawStyles as CalendarStyles, rethemed: false, lockedPaths: [] };
      rows.push({
        id: row.id,
        name: row.name,
        styles: themed.styles,
        lockedPaths: themed.lockedPaths,
        sourcePresetId: readCalendarSourcePreset(row.designJson),
        aspectPreset: row.aspectPreset,
        createdAt: row.updatedAt,
        // A stored thumbnail shows the old theme; re-render instead.
        thumbnailDataUrl:
          !themed.rethemed && typeof row.designJson?.thumbnailDataUrl === 'string'
            ? row.designJson.thumbnailDataUrl
            : undefined,
        aiGenerated: row.designJson?.aiGenerated === true,
        aiGenerationId:
          typeof row.designJson?.aiGenerationId === 'string' ? row.designJson.aiGenerationId : null,
      });
    }
    return rows;
  }, [apiTemplates, themeTokens, themePhoto]);

  const deleteTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const jwt = await getSessionJwt();
        const res = await fetch(scopedFunctionsUrl('marketing-templates', propertyId), {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id }),
        });
        const json = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Delete failed');
        void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });
        return true;
      } catch (error) {
        toast.error((error as Error).message);
        return false;
      }
    },
    [propertyId, queryClient]
  );

  const renameTemplate = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      try {
        const jwt = await getSessionJwt();
        const res = await fetch(scopedFunctionsUrl('marketing-templates', propertyId), {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id, name: trimmed }),
        });
        const json = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Rename failed');
        void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });
        return true;
      } catch (error) {
        toast.error((error as Error).message);
        return false;
      }
    },
    [propertyId, queryClient]
  );

  return useMemo(
    () => ({
      apiTemplates,
      savedTemplates,
      deleteTemplate,
      renameTemplate,
    }),
    [apiTemplates, savedTemplates, deleteTemplate, renameTemplate]
  );
}
