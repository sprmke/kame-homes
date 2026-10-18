import { useState } from 'react';

import { Check, ChevronDown, LayoutGrid, Palette } from 'lucide-react';

import { useMarketingThemeEditor } from '@/features/dashboard/marketing/components/themes/MarketingThemeEditor';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import { ThemeSwatchDots } from '@/features/dashboard/marketing/components/themes/ThemePreview';
import type { MarketingThemeEntry } from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';

import { MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

function itemCountLabel(count: number): string | null {
  if (count === 0) return null;
  return count === 1 ? '1 item' : `${count} items`;
}

/** Header control: which theme you're working in, switch, edit, or browse all. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { library, active, openTheme, showThemes } = useMarketingTheme();
  const { canCreate, canEdit, openEditor } = useMarketingThemeEditor();
  const isBelowLg = useIsBelowLg();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!active) return <Skeleton className={cn('h-9 w-40 rounded-lg', className)} />;

  // Built-ins aren't edited in place; "Customize" makes a copy (needs add access).
  const canChangeActive = active.editable ? canEdit : canCreate;
  const editLabel = active.editable ? 'Edit theme' : 'Customize theme';
  const themes = library.mine.some((entry) => entry.key === active.key)
    ? library.mine
    : [...library.mine, active];

  const trigger = (
    <button
      type="button"
      className={cn(
        'border-border hover:bg-muted/60 flex min-h-[36px] min-w-0 max-w-[16rem] items-center gap-2 rounded-lg border px-2.5 text-sm font-medium max-lg:min-h-[44px]',
        className
      )}
      aria-label={`Theme: ${active.name}. Change theme`}
      onClick={isBelowLg ? () => setSheetOpen(true) : undefined}
    >
      <ThemeSwatchDots tokens={active.tokens} />
      <span className="truncate">{active.name}</span>
      <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </button>
  );

  const pick = (entry: MarketingThemeEntry) => {
    setSheetOpen(false);
    if (entry.key !== active.key) openTheme(entry.key);
  };

  if (isBelowLg) {
    return (
      <>
        {trigger}
        <MobileChoiceSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Themes">
          <ul className="px-2 py-1">
            {themes.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  onClick={() => pick(entry)}
                  className="hover:bg-muted/60 flex min-h-[48px] w-full items-center gap-3 rounded-lg px-2 text-left"
                >
                  <ThemeSwatchDots tokens={entry.tokens} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{entry.name}</span>
                    {itemCountLabel(entry.itemCount) ? (
                      <span className="text-muted-foreground block text-xs">
                        {itemCountLabel(entry.itemCount)}
                      </span>
                    ) : null}
                  </span>
                  {entry.key === active.key ? (
                    <Check className="text-primary size-4" aria-hidden />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-border/60 mt-1 border-t px-2 py-1">
            {canChangeActive ? (
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  openEditor({ mode: 'edit', entry: active });
                }}
                className="hover:bg-muted/60 flex min-h-[48px] w-full items-center gap-3 rounded-lg px-2 text-sm"
              >
                <Palette className="size-4" aria-hidden />
                {editLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                showThemes();
              }}
              className="hover:bg-muted/60 flex min-h-[48px] w-full items-center gap-3 rounded-lg px-2 text-sm"
            >
              <LayoutGrid className="size-4" aria-hidden />
              All themes
            </button>
          </div>
        </MobileChoiceSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
          Your themes
        </DropdownMenuLabel>
        <div className="max-h-72 overflow-y-auto">
          {themes.map((entry) => (
            <DropdownMenuItem key={entry.key} onSelect={() => pick(entry)} className="gap-2.5 py-2">
              <ThemeSwatchDots tokens={entry.tokens} />
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              {itemCountLabel(entry.itemCount) ? (
                <span className="text-muted-foreground text-xs">{entry.itemCount}</span>
              ) : null}
              {entry.key === active.key ? (
                <Check className="text-primary size-4" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        {canChangeActive ? (
          <DropdownMenuItem
            onSelect={() => openEditor({ mode: 'edit', entry: active })}
            className="gap-2.5"
          >
            <Palette className="size-4" aria-hidden />
            {editLabel}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={showThemes} className="gap-2.5">
          <LayoutGrid className="size-4" aria-hidden />
          All themes
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
