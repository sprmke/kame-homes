import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  responseText: string | null;
  label?: string;
  /** Small leading glyph for the label row (e.g. a lock on private notes). */
  icon?: ReactNode;
  /**
   * `brand` marks the host's own voice (a public response); `muted` is anything
   * quoted back at them, like a guest's private note. The two sat in identical
   * gray boxes before — on a card that carries both, they read as one thing.
   */
  tone?: 'brand' | 'muted';
};

/** Quoted block for a host response or a guest's private note on a review card. */
export function ReviewResponseBlock({
  responseText,
  label = 'Your response',
  icon,
  tone = 'brand',
}: Props) {
  if (!responseText) return null;
  return (
    <div
      className={cn(
        /* Same measure as the review body so quoted text does not run wider than it. */
        'max-w-[68ch] rounded-lg border px-3 py-2',
        tone === 'brand' ? 'border-primary/25 bg-primary/[0.06]' : 'border-border bg-muted/40'
      )}
    >
      <p
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium',
          tone === 'brand' ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {icon}
        {label}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{responseText}</p>
    </div>
  );
}
