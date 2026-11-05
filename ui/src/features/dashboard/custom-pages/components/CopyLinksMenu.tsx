import { Fragment, useState, type ComponentType } from 'react';

import { ChevronDown, Copy } from 'lucide-react';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { MobileHeroActionButton } from '@/components/mobile/MobileHeroActionButton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type CopyLinkMenuItem = {
  key: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
  /** Render a divider above this item (group boundary). */
  separatorBefore?: boolean;
};

type Props = {
  items: CopyLinkMenuItem[];
  /** `hero` = icon-only mobile hero control; `desktop` = page header button. */
  variant: 'hero' | 'desktop';
};

const MENU_LABEL = 'Copy links';

/** Copy menu for every guest-shareable link on the page. Picker actions run from here too. */
export function CopyLinksMenu({ items, variant }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (items.length === 0) return null;

  if (variant === 'hero') {
    return (
      <>
        <MobileHeroActionButton
          aria-label={MENU_LABEL}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
        >
          <Copy className="size-4" aria-hidden />
        </MobileHeroActionButton>
        <MobileChoiceSheet open={sheetOpen} onOpenChange={setSheetOpen} title={MENU_LABEL}>
          <div role="listbox" aria-label={MENU_LABEL}>
            {items.map((item) => {
              const Icon = item.Icon;
              return (
                <Fragment key={item.key}>
                  {item.separatorBefore ? (
                    <div className="border-border/60 mx-4 border-t" aria-hidden />
                  ) : null}
                  <MobileChoiceItem
                    label={item.label}
                    icon={<Icon className="size-5" aria-hidden />}
                    onSelect={() => {
                      item.onSelect();
                      setSheetOpen(false);
                    }}
                  />
                </Fragment>
              );
            })}
          </div>
        </MobileChoiceSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="default" className="h-9 gap-2">
          <Copy className="size-4" aria-hidden />
          {MENU_LABEL}
          <ChevronDown className="size-3.5 opacity-80" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {items.map((item) => {
          const Icon = item.Icon;
          return (
            <Fragment key={item.key}>
              {item.separatorBefore ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onSelect={() => item.onSelect()} className="min-h-[44px] gap-2">
                <Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </DropdownMenuItem>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
