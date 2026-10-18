import { useMemo, useState } from 'react';

import { ArrowLeft, Plus } from 'lucide-react';

import { DeleteThemeDialog } from '@/features/dashboard/marketing/components/themes/DeleteThemeDialog';
import { useMarketingThemeEditor } from '@/features/dashboard/marketing/components/themes/MarketingThemeEditor';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import { ThemeCardPreview } from '@/features/dashboard/marketing/components/themes/ThemePreview';
import { MarketingOverflowMenu } from '@/features/dashboard/marketing/components/shared/MarketingOverflowMenu';
import type { MarketingSidebarMenuItem } from '@/features/dashboard/marketing/components/shared/MarketingSidebarSection';
import type { MarketingThemeEntry } from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function countLabel(count: number): string {
  if (count === 0) return 'No items yet';
  return count === 1 ? '1 item' : `${count} items`;
}

function ThemeCard({
  entry,
  active,
  menuItems,
  onOpen,
}: {
  entry: MarketingThemeEntry;
  active: boolean;
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
        className="block w-full text-left"
        aria-label={`Open ${entry.name}`}
      >
        <ThemeCardPreview tokens={entry.tokens} />
        <span className="block px-3 pb-2.5 pr-10 pt-2">
          <span className="line-clamp-2 block text-sm font-medium leading-snug">{entry.name}</span>
          <span className="text-muted-foreground block text-xs">
            {entry.kind === 'starter' && entry.itemCount === 0
              ? entry.group
              : countLabel(entry.itemCount)}
          </span>
        </span>
      </button>
      {menuItems.length > 0 ? (
        <div className="absolute bottom-1.5 right-1">
          <MarketingOverflowMenu label={`${entry.name} options`} menuItems={menuItems} />
        </div>
      ) : null}
    </li>
  );
}

/** The theme library: pick a theme to work in, or start a new one. */
export function ThemesHome() {
  const { library, libraryLoading, active, hasWorkspace, openTheme } = useMarketingTheme();
  const { canCreate, canEdit, openEditor } = useMarketingThemeEditor();
  const [deleting, setDeleting] = useState<MarketingThemeEntry | null>(null);

  const mineKeys = useMemo(() => new Set(library.mine.map((entry) => entry.key)), [library.mine]);
  const starters = library.starters.filter((entry) => !mineKeys.has(entry.key));

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

  const startNew = () =>
    openEditor({
      mode: 'create',
      name: 'My theme',
      tokens: (active ?? library.mine[0]!).tokens,
      source: 'custom',
    });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-3 sm:p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-section-title font-semibold">Themes</h2>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Pick a theme. Calendars, posts and videos you make follow it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {active && hasWorkspace ? (
              <Button variant="outline" size="sm" onClick={() => openTheme(active.key)}>
                <ArrowLeft className="size-4" aria-hidden />
                Back to {active.name}
              </Button>
            ) : null}
            {canCreate ? (
              <Button size="sm" onClick={startNew}>
                <Plus className="size-4" aria-hidden />
                New theme
              </Button>
            ) : null}
          </div>
        </div>

        <section aria-labelledby="your-themes-heading" className="space-y-3">
          <h3 id="your-themes-heading" className="text-sm font-semibold">
            Your themes
          </h3>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {library.mine.map((entry) => (
              <ThemeCard
                key={entry.key}
                entry={entry}
                active={entry.key === active?.key}
                menuItems={menuFor(entry)}
                onOpen={() => openTheme(entry.key)}
              />
            ))}
            {libraryLoading
              ? Array.from({ length: 2 }, (_, index) => (
                  <li key={index}>
                    <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                  </li>
                ))
              : null}
          </ul>
        </section>

        <section aria-labelledby="starter-themes-heading" className="space-y-3">
          <h3 id="starter-themes-heading" className="text-sm font-semibold">
            Starter looks
          </h3>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {starters.map((entry) => (
              <ThemeCard
                key={entry.key}
                entry={entry}
                active={entry.key === active?.key}
                menuItems={menuFor(entry)}
                onOpen={() => openTheme(entry.key)}
              />
            ))}
          </ul>
        </section>
      </div>

      {deleting ? <DeleteThemeDialog entry={deleting} onClose={() => setDeleting(null)} /> : null}
    </div>
  );
}
