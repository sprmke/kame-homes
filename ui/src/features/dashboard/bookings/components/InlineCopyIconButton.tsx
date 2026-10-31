import { Copy } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * 18×18px icon-only copy control, inline after value text. The visible box stays
 * small so it doesn't disrupt inline text layout, but an invisible `::before`
 * pseudo-element expands the actual tap/click target to the 44×44px minimum
 * (WCAG 2.5.5 / iOS HIG) without affecting layout flow — same "hit slop" pattern
 * used for small inline controls on mobile.
 */
export function InlineCopyIconButton({
  'aria-label': ariaLabel,
  disabled,
  onClick,
}: {
  'aria-label': string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative top-px ml-1 inline-flex shrink-0 items-center justify-center rounded border p-0 align-middle transition-colors',
        "before:absolute before:-inset-[13px] before:content-['']",
        disabled
          ? 'border-border bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
          : 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 dark:border-primary/30 dark:bg-primary/10 dark:text-primary dark:hover:bg-primary/20'
      )}
      style={{ width: 18, height: 18, padding: 0 }}
      aria-label={ariaLabel}
    >
      <Copy className="size-2.5 shrink-0" aria-hidden />
    </button>
  );
}
