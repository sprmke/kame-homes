import { useCallback, useMemo, useState } from 'react';

import type {
  AssistantCatalogEntry,
  AssistantCatalogGroup,
} from '@/features/dashboard/ai-assistant/hooks/useAssistantContextCatalog';
import type { AttachedContextType } from '@/features/dashboard/ai-assistant/lib/attachedContext';
import { CONTEXT_CATALOG_GROUPS } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';

export type ContextPickerView =
  { level: 'modules' } | { level: 'items'; moduleType: AttachedContextType; moduleLabel: string };

function matchesNeedle(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

export function useContextPickerNavigation(
  groups: AssistantCatalogGroup[],
  options?: { includePricingModule?: boolean }
) {
  const [view, setView] = useState<ContextPickerView>({ level: 'modules' });
  const [search, setSearch] = useState('');

  const groupByType = useMemo(() => {
    const map = new Map<AttachedContextType, AssistantCatalogGroup>();
    for (const group of groups) {
      map.set(group.type, group);
    }
    return map;
  }, [groups]);

  const moduleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return CONTEXT_CATALOG_GROUPS.filter((module) => {
      if (module.type === 'pricing_date') {
        if (!options?.includePricingModule) return false;
        if (!needle) return true;
        return matchesNeedle(module.label, needle);
      }
      const group = groupByType.get(module.type);
      if (!group || group.items.length === 0) return false;
      if (!needle) return true;
      return matchesNeedle(module.label, needle);
    }).map((module) => ({
      type: module.type,
      label: module.label,
      count:
        module.type === 'pricing_date'
          ? undefined
          : (groupByType.get(module.type)?.totalCount ??
            groupByType.get(module.type)?.items.length ??
            0),
    }));
  }, [groupByType, options?.includePricingModule, search]);

  const activeGroup = view.level === 'items' ? groupByType.get(view.moduleType) : undefined;

  const filteredItems = useMemo((): AssistantCatalogEntry[] => {
    if (view.level !== 'items' || !activeGroup) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return activeGroup.items;
    return activeGroup.items.filter(
      (entry) =>
        matchesNeedle(entry.item.label, needle) ||
        matchesNeedle(entry.keywords, needle) ||
        (entry.subtitle ? matchesNeedle(entry.subtitle, needle) : false) ||
        (entry.meta ? matchesNeedle(entry.meta, needle) : false)
    );
  }, [activeGroup, search, view]);

  const openModule = useCallback((moduleType: AttachedContextType, moduleLabel: string) => {
    setView({ level: 'items', moduleType, moduleLabel });
    setSearch('');
  }, []);

  const backToModules = useCallback(() => {
    setView({ level: 'modules' });
    setSearch('');
  }, []);

  const reset = useCallback(() => {
    setView({ level: 'modules' });
    setSearch('');
  }, []);

  return {
    view,
    search,
    setSearch,
    moduleRows,
    filteredItems,
    activeGroup,
    openModule,
    backToModules,
    reset,
  };
}
