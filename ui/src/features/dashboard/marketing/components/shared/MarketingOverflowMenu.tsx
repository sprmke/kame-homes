import type { MouseEvent } from 'react';

import { MoreHorizontal, MoreVertical } from 'lucide-react';

import type { MarketingSidebarMenuItem } from '@/features/dashboard/marketing/components/shared/MarketingSidebarSection';

import {
  ResponsiveOverflowMenu,
  type ResponsiveOverflowAction,
} from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function toActionGroups(items: MarketingSidebarMenuItem[]): ResponsiveOverflowAction[][] {
  return [
    items.map((item) => ({
      key: item.id,
      label: item.label,
      destructive: item.destructive,
      onSelect: item.onSelect,
    })),
  ];
}

type Props = {
  label: string;
  menuItems: MarketingSidebarMenuItem[];
  icon?: 'horizontal' | 'vertical';
  triggerClassName?: string;
  sheetTitle?: string;
  onTriggerClick?: (event: MouseEvent) => void;
};

/** Overflow actions in marketing surfaces: sheet on mobile, dropdown on desktop. */
export function MarketingOverflowMenu({
  label,
  menuItems,
  icon = 'vertical',
  triggerClassName,
  sheetTitle,
  onTriggerClick,
}: Props) {
  if (menuItems.length === 0) return null;

  const Icon = icon === 'horizontal' ? MoreHorizontal : MoreVertical;

  return (
    <ResponsiveOverflowMenu
      label={label}
      sheetTitle={sheetTitle ?? label}
      actionGroups={toActionGroups(menuItems)}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(triggerClassName)}
          aria-label={label}
          onClick={onTriggerClick}
        >
          <Icon className="size-3.5" aria-hidden />
        </Button>
      }
    />
  );
}
