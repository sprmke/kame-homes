import { cn } from '@/lib/utils';

export type HostListingTab = 'homes' | 'parkings';

type Props = {
  active: HostListingTab;
  homesCount: number;
  parkingsCount: number;
  onChange: (tab: HostListingTab) => void;
};

const TAB_LABELS: Record<HostListingTab, string> = {
  homes: 'Homes',
  parkings: 'Parkings',
};

/** Segmented tabs with counts — uses org `--primary` from `GuestPublicBrandShell`. */
export function HostPublicListingsTabs({ active, homesCount, parkingsCount, onChange }: Props) {
  const tabs: Array<{ id: HostListingTab; label: string; count: number }> = [];

  if (homesCount > 0) {
    tabs.push({ id: 'homes', label: TAB_LABELS.homes, count: homesCount });
  }
  if (parkingsCount > 0) {
    tabs.push({ id: 'parkings', label: TAB_LABELS.parkings, count: parkingsCount });
  }

  if (tabs.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Listing types"
      className="bg-muted/60 border-border/60 inline-flex max-w-full rounded-full border p-1"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              'min-h-[44px] shrink-0 rounded-full px-4 text-sm font-medium transition-[color,background-color,box-shadow]',
              selected
                ? 'bg-primary-strong text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            <span
              className={cn(
                'ml-1.5 tabular-nums',
                selected ? 'text-primary-foreground/85' : 'opacity-70'
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
