import { useState, type ReactNode } from 'react';

import { ChevronDown, Plus } from 'lucide-react';

import { MarketingOverflowMenu } from '@/features/dashboard/marketing/components/shared/MarketingOverflowMenu';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type MarketingSidebarMenuItem = {
  id: string;
  label: string;
  destructive?: boolean;
  onSelect: () => void;
};

type Props = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  menuItems?: MarketingSidebarMenuItem[];
  className?: string;
};

export function MarketingSidebarSection({
  title,
  children,
  defaultOpen = true,
  collapsible = true,
  onAdd,
  addLabel = 'Add',
  menuItems,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <section className={cn('space-y-2', className)}>
        <div className="flex items-center gap-1">
          <h3 className="text-muted-foreground min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider">
            {title}
          </h3>
          {onAdd ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-8 min-h-[36px] min-w-[36px] shrink-0"
              aria-label={addLabel}
              onClick={onAdd}
            >
              <Plus className="size-3.5" aria-hidden />
            </Button>
          ) : null}
          {menuItems && menuItems.length > 0 ? (
            <MarketingOverflowMenu
              label={`${title} options`}
              menuItems={menuItems}
              triggerClassName="size-8 min-h-[36px] min-w-[36px] shrink-0 text-muted-foreground hover:text-foreground"
            />
          ) : null}
        </div>
        {children}
      </section>
    );
  }

  return (
    <section className={cn('space-y-2', className)}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="hover:bg-muted/60 flex min-h-[36px] min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-left transition-colors"
        >
          <ChevronDown
            className={cn(
              'text-muted-foreground size-3.5 shrink-0 transition-transform',
              !open && '-rotate-90'
            )}
            aria-hidden
          />
          <span className="text-muted-foreground truncate text-[11px] font-semibold uppercase tracking-wider">
            {title}
          </span>
        </button>
        {onAdd ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-8 min-h-[36px] min-w-[36px] shrink-0"
            aria-label={addLabel}
            onClick={onAdd}
          >
            <Plus className="size-3.5" aria-hidden />
          </Button>
        ) : null}
        {menuItems && menuItems.length > 0 ? (
          <MarketingOverflowMenu
            label={`${title} options`}
            menuItems={menuItems}
            triggerClassName="size-8 min-h-[36px] min-w-[36px] shrink-0 text-muted-foreground hover:text-foreground"
          />
        ) : null}
      </div>
      {open ? children : null}
    </section>
  );
}
