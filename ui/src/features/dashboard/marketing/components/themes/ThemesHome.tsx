import { useState } from 'react';

import { Plus } from 'lucide-react';

import { MarketingOverflowMenu } from '@/features/dashboard/marketing/components/shared/MarketingOverflowMenu';
import type { MarketingSidebarMenuItem } from '@/features/dashboard/marketing/components/shared/MarketingSidebarSection';
import { DeleteThemeDialog } from '@/features/dashboard/marketing/components/themes/DeleteThemeDialog';
import { useMarketingThemeEditor } from '@/features/dashboard/marketing/components/themes/MarketingThemeEditor';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import { ThemeShowcase } from '@/features/dashboard/marketing/components/themes/ThemeShowcase';
import type { MarketingThemeEntry } from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';

import { MarketingThemeCardSkeleton } from '@/components/skeletons/AdminSkeletons';
import { cn } from '@/lib/utils';

function countLabel(count: number): string {
  if (count === 0) return 'Nothing saved yet';
  return count === 1 ? '1 item' : `${count} items`;
}

function ThemeCard({
  entry,
  active,
  propertyName,
  photoUrl,
  menuItems,
  onOpen,
}: {
  entry: MarketingThemeEntry;
  active: boolean;
  propertyName: string;
  photoUrl?: string;
  menuItems: MarketingSidebarMenuItem[];
  onOpen: () => void;
}) {
  return (
    <li
      className={cn(
        'bg-card group relative overflow-hidden rounded-xl border transition-shadow',
        active ? 'border-primary ring-primary/25 ring-2' : 'border-border hover:shadow-md'
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="focus-visible:ring-ring block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <ThemeShowcase
          tokens={entry.tokens}
          calendarLayoutId={entry.calendarLayoutId}
          propertyName={propertyName}
          photoUrl={photoUrl}
          className="transition-transform duration-300 group-hover:scale-[1.015]"
        />
        <span className="flex min-h-[52px] flex-col justify-center px-3 py-2 pr-11">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">
              {entry.name}
            </span>
            {active ? (
              <span className="bg-primary/10 text-brand-ink shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                Open now
              </span>
            ) : null}
          </span>
          <span className="text-muted-foreground block text-xs">{countLabel(entry.itemCount)}</span>
        </span>
      </button>
      {menuItems.length > 0 ? (
        <div className="absolute bottom-2 right-1.5">
          <MarketingOverflowMenu label={`${entry.name} options`} menuItems={menuItems} />
        </div>
      ) : null}
    </li>
  );
}

/** The theme library: the host's own themes. Starter looks live in "New theme". */
export function ThemesHome() {
  const { property } = useOrgContext();
  const { library, libraryLoading, active, hasWorkspace, openTheme, coverPhotoUrl } =
    useMarketingTheme();
  const { canCreate, canEdit, openEditor, openNewTheme } = useMarketingThemeEditor();
  const [deleting, setDeleting] = useState<MarketingThemeEntry | null>(null);

  // A starter look you're working in stays listed even before anything is saved in it.
  const themes =
    active && !library.mine.some((entry) => entry.key === active.key)
      ? [...library.mine, active]
      : library.mine;

  const menuFor = (entry: MarketingThemeEntry): MarketingSidebarMenuItem[] => {
    const items: MarketingSidebarMenuItem[] = [];
    if (entry.editable && canEdit) {
      items.push({
        id: 'edit',
        label: 'Edit',
        onSelect: () => openEditor({ mode: 'edit', entry }),
      });
    } else if (!entry.editable && canCreate) {
      items.push({
        id: 'customize',
        label: 'Customize',
        onSelect: () => openEditor({ mode: 'edit', entry }),
      });
    }
    if (canCreate) {
      items.push({
        id: 'duplicate',
        label: 'Duplicate',
        onSelect: () =>
          openEditor({
            mode: 'create',
            name: `${entry.name} copy`,
            tokens: entry.tokens,
            source: 'duplicate',
            sourceRef: entry.key,
          }),
      });
    }
    if (entry.kind === 'custom' && canEdit) {
      items.push({
        id: 'delete',
        label: 'Delete',
        destructive: true,
        onSelect: () => setDeleting(entry),
      });
    }
    return items;
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4 lg:p-6">
        <div className="min-w-0">
          <h2 className="text-section-title font-semibold">Themes</h2>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Everything you make in a theme uses its colors and fonts.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          <li className="min-h-[9rem]">
            <button
              type="button"
              onClick={openNewTheme}
              className="border-border text-muted-foreground hover:border-primary/60 hover:text-foreground hover:bg-muted/40 focus-visible:ring-ring flex size-full min-h-[9rem] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              <span className="bg-muted flex size-10 items-center justify-center rounded-full">
                <Plus className="size-5" aria-hidden />
              </span>
              <span className="text-foreground text-sm font-medium">
                {canCreate ? 'New theme' : 'More looks'}
              </span>
              <span className="text-xs">
                {canCreate ? 'Start from a look or describe one' : 'Try a starter look'}
              </span>
            </button>
          </li>
          {themes.map((entry) => (
            <ThemeCard
              key={entry.key}
              entry={entry}
              active={hasWorkspace && entry.key === active?.key}
              propertyName={property.name}
              photoUrl={coverPhotoUrl}
              menuItems={menuFor(entry)}
              onOpen={() => openTheme(entry.key)}
            />
          ))}
          {libraryLoading
            ? Array.from({ length: 3 }).map((_, index) => (
                <li key={index}>
                  <MarketingThemeCardSkeleton />
                </li>
              ))
            : null}
        </ul>
      </div>

      {deleting ? <DeleteThemeDialog entry={deleting} onClose={() => setDeleting(null)} /> : null}
    </div>
  );
}
