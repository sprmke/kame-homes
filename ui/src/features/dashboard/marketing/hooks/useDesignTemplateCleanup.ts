import { useEffect, useRef } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import {
  deleteMarketingTemplate,
  fetchMarketingTemplates,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { planDesignAutosavePurge } from '@/features/dashboard/marketing/lib/designAutosave';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

const purgeStorageKey = (propertyId: string | null) =>
  `marketing-design-autosave-purge:v1:${propertyId ?? 'default'}`;

/**
 * One-time per property: delete infinite preset-autosave rows created before
 * design upsert-by-preset was fixed. Explicit custom saves are kept.
 */
export function useDesignTemplateCleanup(enabled: boolean) {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current || typeof window === 'undefined') return;
    startedRef.current = true;

    const storageKey = purgeStorageKey(propertyId);
    if (window.localStorage.getItem(storageKey) === 'done') return;

    void (async () => {
      try {
        const templates = await fetchMarketingTemplates(propertyId);
        const removeIds = planDesignAutosavePurge(templates);
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
