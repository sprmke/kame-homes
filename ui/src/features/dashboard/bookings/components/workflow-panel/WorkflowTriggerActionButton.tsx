/**
 * Automation Triggers action — unified tooltip (action + blocker when disabled).
 */

import type { ReactNode } from 'react';

import { workflowNeutralActionClass } from '@/features/dashboard/bookings/lib/workflowActionButtonStyles';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Props = {
  disabled: boolean;
  /** Shown on hover — what the action does, plus why it is blocked when disabled. */
  tooltip?: string | null;
  pending?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
  trailing?: ReactNode;
};

export function WorkflowTriggerActionButton({
  disabled,
  tooltip,
  pending = false,
  onClick,
  className,
  children,
  trailing,
}: Props) {
  const isDisabled = disabled || pending;
  const button = (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      aria-disabled={isDisabled || undefined}
      className={cn(
        workflowNeutralActionClass(),
        'min-w-0 flex-1',
        isDisabled && !pending && disabled && 'cursor-not-allowed',
        className
      )}
    >
      <span className="truncate">{children}</span>
      {trailing}
    </button>
  );

  const tooltipText = tooltip?.trim() ? tooltip : null;

  if (tooltipText) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex min-w-0 flex-1">{button}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[min(90vw,18rem)] text-xs leading-snug">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
