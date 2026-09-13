import {
  Fragment,
  cloneElement,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import { MoreHorizontal } from 'lucide-react';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export type ResponsiveOverflowAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type TriggerProps = {
  onClick: (event: React.MouseEvent) => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'dialog' | 'menu';
};

type Props = {
  /** Accessible name for the trigger (e.g. “Actions for Meralco bill”). */
  label: string;
  sheetTitle?: string;
  sheetDescription?: string;
  /** Separate groups render with dividers between them. */
  actionGroups: ResponsiveOverflowAction[][];
  trigger?: ReactElement<TriggerProps>;
  triggerClassName?: string;
  dropdownContentClassName?: string;
};

/**
 * Overflow actions: bottom sheet on phone/tablet (`max-lg`), dropdown on desktop (`lg+`).
 */
export function ResponsiveOverflowMenu({
  label,
  sheetTitle,
  sheetDescription,
  actionGroups,
  trigger,
  triggerClassName,
  dropdownContentClassName,
}: Props) {
  const isMobileLayout = useIsBelowLg();
  const [sheetOpen, setSheetOpen] = useState(false);
  const visibleGroups = actionGroups
    .map((group) => group.filter((action) => !action.disabled))
    .filter((group) => group.length > 0);

  if (visibleGroups.length === 0) return null;

  const title = sheetTitle ?? label;

  const openSheet = (event: React.MouseEvent) => {
    event.stopPropagation();
    setSheetOpen(true);
  };

  const triggerProps: TriggerProps = {
    onClick: openSheet,
    'aria-expanded': sheetOpen,
    'aria-haspopup': isMobileLayout ? 'dialog' : 'menu',
  };

  const defaultTrigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn('admin-overflow-trigger', triggerClassName)}
      aria-label={label}
      {...triggerProps}
    >
      <MoreHorizontal className="size-3.5" aria-hidden />
    </Button>
  );

  const renderedTrigger =
    trigger && isValidElement(trigger)
      ? cloneElement(trigger, {
          ...triggerProps,
          onClick: (event: React.MouseEvent) => {
            trigger.props.onClick?.(event);
            if (!event.defaultPrevented) openSheet(event);
          },
        } as Partial<TriggerProps>)
      : defaultTrigger;

  if (isMobileLayout) {
    return (
      <>
        {renderedTrigger}
        <MobileChoiceSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={title}
          description={sheetDescription}
        >
          <div role="listbox" aria-label={title}>
            {visibleGroups.map((group, groupIndex) => (
              <div
                key={group[0]?.key ?? groupIndex}
                role="group"
                className={cn(groupIndex > 0 && 'border-separator mt-1 border-t pt-1')}
              >
                {group.map((action) => (
                  <MobileChoiceItem
                    key={action.key}
                    label={action.label}
                    icon={action.icon}
                    disabled={action.disabled}
                    className={
                      action.destructive
                        ? 'text-destructive [&_.text-foreground]:text-destructive [&_.text-muted-foreground]:text-destructive'
                        : undefined
                    }
                    onSelect={() => {
                      action.onSelect();
                      setSheetOpen(false);
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </MobileChoiceSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
        {renderedTrigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn('min-w-[10rem]', dropdownContentClassName)}>
        {visibleGroups.map((group, groupIndex) => (
          <Fragment key={group[0]?.key ?? groupIndex}>
            {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuGroup>
              {group.map((action) => (
                <DropdownMenuItem
                  key={action.key}
                  disabled={action.disabled}
                  onSelect={() => action.onSelect()}
                  className={cn(
                    'min-h-[40px] gap-2',
                    action.destructive && 'text-destructive focus:text-destructive'
                  )}
                >
                  {action.icon}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
