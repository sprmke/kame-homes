import { useMemo, useState } from 'react';

import { X } from 'lucide-react';

import { getFeatureAvailabilityCatalogEntry } from '@/lib/featureAvailability/featureAvailabilityCatalog';
import { useFeatureAvailabilitySnapshot } from '@/lib/featureAvailability/useFeatureAvailability';
const DISMISS_PREFIX = 'gfm.featureAvailabilityBanner.dismiss:';

function dismissStorageKey(featureKey: string, updatedAt: string | null): string {
  return `${DISMISS_PREFIX}${featureKey}:${updatedAt ?? 'none'}`;
}

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // private mode — session-only dismiss via React state
  }
}

export function FeatureAvailabilityBanner() {
  const { data } = useFeatureAvailabilitySnapshot();
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(() => new Set());

  const visible = useMemo(() => {
    if (!data?.entries.length) return [];
    return data.entries.filter((entry) => {
      if (!entry.showBanner || entry.available) return false;
      const catalog = getFeatureAvailabilityCatalogEntry(entry.key);
      if (!catalog) return false;
      const storageKey = dismissStorageKey(entry.key, entry.updatedAt);
      if (sessionDismissed.has(storageKey)) return false;
      if (readDismissed(storageKey)) return false;
      return true;
    });
  }, [data?.entries, sessionDismissed]);

  if (visible.length === 0) return null;

  const primary = visible[0]!;
  const catalog = getFeatureAvailabilityCatalogEntry(primary.key);
  const title = catalog?.label ?? primary.key;
  const extra = visible.length - 1;

  const dismissPrimary = () => {
    const storageKey = dismissStorageKey(primary.key, primary.updatedAt);
    writeDismissed(storageKey);
    setSessionDismissed((prev) => new Set(prev).add(storageKey));
  };

  return (
    <div
      role="status"
      className="border-border/60 text-foreground border-b bg-amber-500/10 px-3 py-2 sm:px-4"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-2">
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">{title}</p>
          <p className="text-muted-foreground text-xs sm:text-[13px]">{primary.message}</p>
          {extra > 0 ? <p className="text-muted-foreground mt-0.5 text-xs">+{extra} more</p> : null}
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          aria-label="Dismiss banner"
          onClick={dismissPrimary}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
