import { Fragment, useState } from 'react';

import { MoreHorizontal } from 'lucide-react';

import type { BookingDetailAction } from '@/features/dashboard/bookings/lib/bookingDetailActions';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';

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

type Props = {
  actions: BookingDetailAction[];
  className?: string;
};

const TRIGGER_LABEL = 'More actions';

/**
 * Consecutive same-group actions become one block, so "change this booking" and
 * "share with the guest" are separated instead of reading as one flat list.
 */
function groupActions(actions: BookingDetailAction[]): BookingDetailAction[][] {
  return actions.reduce<BookingDetailAction[][]>((groups, action) => {
    const last = groups.at(-1);
    if (last && last[0].group === action.group) last.push(action);
    else groups.push([action]);
    return groups;
  }, []);
}

/** One overflow trigger for booking actions — sheet on phone/tablet, dropdown above `lg`. */
export function BookingDetailActionsMenu({ actions, className }: Props) {
  const isMobileLayout = useIsBelowLg();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (actions.length === 0) return null;

  const triggerClassName = cn('h-11 w-11 shrink-0 p-0 lg:h-9 lg:w-9', className);

  if (isMobileLayout) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={TRIGGER_LABEL}
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
          onClick={() => setSheetOpen(true)}
          className={triggerClassName}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
        <MobileChoiceSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Booking actions">
          <div role="listbox" aria-label="Booking actions">
            {groupActions(actions).map((group, groupIndex) => (
              <div
                key={group[0].group}
                role="group"
                className={cn(groupIndex > 0 && 'border-separator mt-1 border-t pt-1')}
              >
                {group.map((action) => {
                  const Icon = action.Icon;
                  return (
                    <MobileChoiceItem
                      key={action.key}
                      label={action.label}
                      icon={<Icon className="size-5" aria-hidden />}
                      trailing={
                        action.planFeature ? <TierBadge feature={action.planFeature} /> : undefined
                      }
                      onSelect={() => {
                        action.onSelect();
                        setSheetOpen(false);
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </MobileChoiceSheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={TRIGGER_LABEL}
          className={triggerClassName}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {groupActions(actions).map((group, groupIndex) => (
          <Fragment key={group[0].group}>
            {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuGroup>
              {group.map((action) => {
                const Icon = action.Icon;
                return (
                  <DropdownMenuItem
                    key={action.key}
                    onSelect={() => action.onSelect()}
                    className="min-h-[40px] gap-2"
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {action.label}
                    {action.planFeature ? (
                      <TierBadge feature={action.planFeature} className="ml-auto" />
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
