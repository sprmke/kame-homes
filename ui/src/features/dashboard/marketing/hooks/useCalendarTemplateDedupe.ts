import { useEffect, useRef } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import {
  deleteMarketingTemplate,
  fetchMarketingTemplates,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import {
  planCalendarDefaultAutosaveCleanup,
  planCalendarOrphanCleanup,
  planCalendarTemplateDedupe,
} from '@/features/dashboard/marketing/lib/calendarAutosave';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

const dedupeStorageKey = (propertyId: string | null) =>
  `marketing-calendar-dedupe:v3:${propertyId ?? 'default'}`;

/** One-time per property: remove duplicate calendar autosave rows (keep newest per preset+format). */
export function useCalendarTemplateDedupe(enabled: boolean) {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current || typeof window === 'undefined') return;
    startedRef.current = true;

    const storageKey = dedupeStorageKey(propertyId);
    if (window.localStorage.getItem(storageKey) === 'done') return;

    void (async () => {
      try {
        const templates = await fetchMarketingTemplates(propertyId);
        const removeIds = [
          ...new Set([
            ...planCalendarTemplateDedupe(templates),
            ...planCalendarOrphanCleanup(templates),
            ...planCalendarDefaultAutosaveCleanup(templates),
          ]),
        ];
        if (removeIds.length === 0) {
          window.localStorage.setItem(storageKey, 'done');
          return;
        }

        await Promise.all(removeIds.map((id) => deleteMarketingTemplate(propertyId, id)));
        void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });
        window.localStorage.setItem(storageKey, 'done');
      } catch {
        startedRef.current = false;
      }
    })();
  }, [enabled, propertyId, queryClient]);
}
