import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type MouseEvent,
  type ReactElement,
} from 'react';

import { MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { FeatureUnavailablePanel } from '@/components/feature-availability/FeatureUnavailablePanel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import type { FeatureAvailabilityKey } from '@/lib/featureAvailability/featureAvailabilityCatalog';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';
import { cn } from '@/lib/utils';

type Props = {
  featureKey: FeatureAvailabilityKey;
  children: ReactElement<{
    className?: string;
    disabled?: boolean;
    onClick?: (e: MouseEvent) => void;
  }>;
  className?: string;
};

export function FeatureAvailabilityButton({ featureKey, children, className }: Props) {
  const view = useFeatureAvailability(featureKey);
  const belowLg = useIsBelowLg();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const descriptionId = useId();

  if (view.available && !view.isLoading) {
    return children;
  }

  if (!isValidElement(children)) {
    return children;
  }

  const blocked = !view.available;

  const openReason = () => {
    if (belowLg) setSheetOpen(true);
    else setPopoverOpen(true);
  };

  const child = cloneElement(children, {
    className: cn(children.props.className, blocked && 'opacity-60'),
    disabled: false,
    onClick: (event: MouseEvent) => {
      if (blocked) {
        event.preventDefault();
        event.stopPropagation();
        openReason();
        return;
      }
      children.props.onClick?.(event);
    },
    ...(blocked ? { 'aria-disabled': true, 'aria-describedby': descriptionId } : {}),
  } as Partial<typeof children.props>);

  const panel = (
    <FeatureUnavailablePanel
      label={view.label}
      message={view.message}
      expectedBackLabel={view.expectedBackLabel}
      reason={view.reason}
      tone={view.tone}
      compact
    />
  );

  return (
    <span className={cn('inline-flex', className)}>
      {belowLg ? (
        <>
          {child}
          <MobileChoiceSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title={view.label}
            description={view.message}
          >
            <div id={descriptionId} className="px-2 pb-4">
              {panel}
            </div>
          </MobileChoiceSheet>
        </>
      ) : (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>{child}</PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="center" id={descriptionId}>
            {panel}
          </PopoverContent>
        </Popover>
      )}
    </span>
  );
}
