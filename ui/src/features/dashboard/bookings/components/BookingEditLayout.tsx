/**
 * Shared layout primitives for BookingEditForm and Progress-rail form fields.
 *
 * Prefer `booking-detail/edit/BookingEditFields.tsx` for new edit-tab work.
 * This file re-exports the same field primitives so WorkflowFormShell /
 * GuestSdRefund* stay in sync with the booking edit visual language.
 */

import React from 'react';

import { ChevronDown, Save, X } from 'lucide-react';

export {
  CheckboxOption,
  Field,
  fieldAriaProps,
  fieldControlClass,
  fieldErrorId,
  fieldErrorMessage,
  Input,
  inputClass,
  Row2,
  Row3,
  Section,
} from '@/features/dashboard/bookings/components/booking-detail/edit/BookingEditFields';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export function CollapsibleGroup({
  id,
  title,
  defaultOpen = true,
  variant = 'standalone',
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  variant?: 'standalone' | 'nested';
  children: React.ReactNode;
}) {
  const isNested = variant === 'nested';
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn(
        'group/collapse overflow-hidden',
        isNested
          ? 'border-border/60 border-b last:border-b-0'
          : cn(
              'border-border/70 bg-card rounded-2xl border shadow-md',
              'ring-border/30 dark:ring-border/50 ring-1'
            )
      )}
    >
      <CollapsibleTrigger
        type="button"
        className={cn(
          'flex min-h-[48px] w-full cursor-pointer items-center gap-3 px-4 py-3 text-left sm:px-5',
          'hover:bg-muted/45 focus-visible:ring-ring focus-visible:ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          isNested
            ? 'border-border/60 bg-muted/20 border-b group-data-[state=closed]/collapse:border-b-0'
            : 'border-border/60 bg-muted/30 border-b'
        )}
        aria-controls={`${id}-panel`}
      >
        <span className="text-card-title min-w-0 flex-1 !text-sm font-semibold tracking-tight">
          {title}
        </span>
        <ChevronDown
          className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapse:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          id={`${id}-panel`}
          className={cn('space-y-4 px-3 py-4 sm:space-y-5 sm:px-5 sm:py-5', 'bg-card')}
        >
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function EditSectionJumpNav({
  sections,
  className,
}: {
  sections: { id: string; label: string }[];
  className?: string;
}) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      aria-label="Edit form sections"
      className={cn('-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1', className)}
    >
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => scrollTo(section.id)}
          className={cn(
            'border-border/60 bg-muted/30 text-foreground/80 hover:border-primary/30 hover:bg-muted/50 shrink-0 cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
            'focus-visible:ring-ring min-h-[44px] focus-visible:outline-none focus-visible:ring-2'
          )}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

export function EditStickyBar({
  onCancel,
  cancelDisabled,
  saveDisabled,
  savePending,
  saveLabel,
  formId,
}: {
  onCancel: () => void;
  cancelDisabled?: boolean;
  saveDisabled?: boolean;
  savePending?: boolean;
  saveLabel: string;
  /** When save button sits outside `<form>`, associate via form attribute. */
  formId?: string;
}) {
  return (
    <div
      className={cn(
        'border-border/70 bg-background/95 border-t px-3 py-3 backdrop-blur-sm sm:px-5',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))]'
      )}
    >
      <div className="flex items-center justify-end gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelDisabled}
          className="border-border text-muted-foreground hover:bg-muted/50 inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="size-3.5" aria-hidden />
          Cancel
        </button>
        <Button
          type="submit"
          form={formId}
          disabled={saveDisabled}
          size="sm"
          className="min-h-[44px] rounded-lg px-5"
        >
          <Save className="size-3.5" aria-hidden />
          {savePending ? 'Saving…' : saveLabel}
        </Button>
      </div>
    </div>
  );
}
