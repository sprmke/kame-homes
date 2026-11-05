import { useState, type ComponentType } from 'react';

import { Copy } from 'lucide-react';

import { copyGuestLink } from '@/features/dashboard/custom-pages/lib/copyGuestLink';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { MobileHeroActionButton } from '@/components/mobile/MobileHeroActionButton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type CopyLinkMenuItem = {
  key: string;
  label: string;
  href: string;
  Icon: ComponentType<{ className?: string }>;
};

type Props = {
  items: CopyLinkMenuItem[];
  /** `hero` = icon-only mobile hero control; `desktop` = page header button. */
  variant: 'hero' | 'desktop';
};

const MENU_LABEL = 'Copy links';

/** Quick-copy menu for guest links that work without a booking. */
export function CopyLinksMenu({ items, variant }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (items.length === 0) return null;

  const copy = (item: CopyLinkMenuItem) => {
    void copyGuestLink(item.href, item.label);
  };

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
                <MobileChoiceItem
                  key={item.key}
                  label={item.label}
                  icon={<Icon className="size-5" aria-hidden />}
                  onSelect={() => {
                    copy(item);
                    setSheetOpen(false);
                  }}
                />
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
        <Button type="button" variant="outline" className="h-9 gap-2">
          <Copy className="size-4" aria-hidden />
          {MENU_LABEL}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {items.map((item) => {
          const Icon = item.Icon;
          return (
            <DropdownMenuItem
              key={item.key}
              onSelect={() => copy(item)}
              className="min-h-[44px] gap-2"
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
