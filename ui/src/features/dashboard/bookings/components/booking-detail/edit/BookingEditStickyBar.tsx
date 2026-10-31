import { Save, X } from 'lucide-react';

import { ContextualActionBar } from '@/components/mobile/ContextualActionBar';
import { Button } from '@/components/ui/button';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

export type BookingEditActionsProps = {
  onCancel: () => void;
  cancelDisabled?: boolean;
  saveDisabled?: boolean;
  savePending?: boolean;
  saveLabel: string;
  /** Save button submits this form id — works whether or not the control is a DOM child of the `<form>`. */
  formId?: string;
  /** Header strip is denser; sticky / contextual bar uses the default size. */
  density?: 'header' | 'bar';
};

/** Shared Cancel + Save pair for the edit header and sticky / contextual bars. */
export function BookingEditActions({
  onCancel,
  cancelDisabled,
  saveDisabled,
  savePending,
  saveLabel,
  formId,
  density = 'bar',
}: BookingEditActionsProps) {
  const isHeader = density === 'header';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2',
        isHeader ? 'self-end sm:self-auto' : 'mx-auto max-w-screen-2xl justify-end sm:gap-3'
      )}
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={cancelDisabled}
        aria-label="Cancel editing"
        className={cn(
          'border-border/80 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          isHeader ? 'px-3 text-xs' : 'border-border px-4 text-sm font-medium'
        )}
      >
        <X className="size-3.5" aria-hidden />
        Cancel
      </button>
      <Button
        type="submit"
        form={formId}
        disabled={saveDisabled}
        size="sm"
        aria-busy={savePending || undefined}
        className={cn('min-h-[44px] rounded-lg', isHeader ? 'px-3.5 text-xs' : 'px-5')}
      >
        <Save className="size-3.5" aria-hidden />
        {savePending ? 'Saving…' : saveLabel}
      </Button>
    </div>
  );
}

/**
 * Cancel/Save action bar for the edit form (scroll / mobile chrome).
 *
 * - Mobile / tablet (`<lg`): claims the shared bottom band via `ContextualActionBar`
 *   (replaces the admin tab bar while editing).
 * - Desktop (`lg+`): sticky within the edit panel scroll context.
 *
 * The edit shell header also renders `BookingEditActions` so Cancel + Save are
 * visible without scrolling.
 */
export function BookingEditStickyBar({
  onCancel,
  cancelDisabled,
  saveDisabled,
  savePending,
  saveLabel,
  formId,
}: Omit<BookingEditActionsProps, 'density'>) {
  const isBelowLg = useIsBelowLg();

  const actions = (
    <BookingEditActions
      onCancel={onCancel}
      cancelDisabled={cancelDisabled}
      saveDisabled={saveDisabled}
      savePending={savePending}
      saveLabel={saveLabel}
      formId={formId}
      density="bar"
    />
  );

  if (isBelowLg) {
    return <ContextualActionBar>{actions}</ContextualActionBar>;
  }

  return (
    <div
      className={cn('border-border/70 bg-card border-t px-3 py-3 sm:px-5', 'sticky bottom-0 z-0')}
    >
      {actions}
    </div>
  );
}
