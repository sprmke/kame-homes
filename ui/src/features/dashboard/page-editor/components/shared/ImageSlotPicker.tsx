import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
  images: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  max?: number;
  /** Which section these slots feed — keeps Hero vs Gallery selection clear. */
  scope?: 'hero' | 'gallery';
  /** Hero uses one photo; gallery stays multi-select. */
  selectionMode?: 'multi' | 'single';
};

/**
 * Empty `selected` = use all property photos (runtime default).
 * Multi: UI treats that as every thumb selected.
 * Single: empty = first property photo (what hero actually renders).
 */
export function ImageSlotPicker({
  images,
  selected,
  onChange,
  max = 9,
  scope,
  selectionMode = 'multi',
}: Props) {
  const usingAll = selected.length === 0;
  const scopeLabel = scope === 'hero' ? 'hero' : scope === 'gallery' ? 'gallery' : 'section';

  if (images.length === 0) {
    return <p className="text-muted-foreground text-sm">No property photos yet.</p>;
  }

  if (selectionMode === 'single') {
    const activeUrl = selected[0] ?? images[0]!;
    return (
      <div className="space-y-2">
        <Label>Photo</Label>
        <ul className="grid grid-cols-3 gap-2">
          {images.map((url) => {
            const active = url === activeUrl;
            return (
              <li key={url}>
                <button
                  type="button"
                  onClick={() => onChange(url === images[0] && usingAll ? [] : [url])}
                  className={cn(
                    'relative aspect-square w-full overflow-hidden rounded-md border',
                    active ? 'border-primary ring-primary/30 ring-2' : 'border-border opacity-50'
                  )}
                  aria-pressed={active}
                  aria-label={active ? 'Hero photo' : 'Use as hero photo'}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const activeSet = new Set(usingAll ? images : selected);

  const toggle = (url: string) => {
    if (usingAll) {
      onChange(images.filter((entry) => entry !== url));
      return;
    }

    if (activeSet.has(url)) {
      const next = selected.filter((entry) => entry !== url);
      // Empty array = "all photos" again — keep at least one selected when curating.
      if (next.length === 0) return;
      onChange(next.length >= images.length ? [] : next);
      return;
    }

    if (selected.length >= max) return;
    const next = [...selected, url];
    onChange(next.length >= images.length ? [] : next);
  };

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        {usingAll
          ? `All photos on ${scopeLabel}. Tap to exclude.`
          : `${selected.length} on ${scopeLabel}. Tap to change.`}
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {images.map((url) => {
          const active = activeSet.has(url);
          return (
            <li key={url}>
              <button
                type="button"
                onClick={() => toggle(url)}
                className={cn(
                  'relative aspect-square w-full overflow-hidden rounded-md border',
                  active ? 'border-primary ring-primary/30 ring-2' : 'border-border opacity-50'
                )}
                aria-pressed={active}
                aria-label={active ? `Remove from ${scopeLabel}` : `Add to ${scopeLabel}`}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
