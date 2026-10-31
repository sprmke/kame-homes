import { Check } from 'lucide-react';

import type { VerificationChecklistItem } from '@/features/dashboard/org/lib/orgVerificationTiers';

import { cn } from '@/lib/utils';

type Props = {
  items: VerificationChecklistItem[];
  className?: string;
  compact?: boolean;
};

export function VerificationChecklist({ items, className, compact = false }: Props) {
  return (
    <ul className={cn(compact ? 'grid gap-1.5 sm:grid-cols-2' : 'space-y-2', className)}>
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2">
          <span
            className={cn(
              'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full',
              item.complete
                ? 'bg-emerald-500/15 text-emerald-600'
                : 'bg-muted text-muted-foreground/60'
            )}
            aria-hidden
          >
            {item.complete ? (
              <Check className="size-2.5" strokeWidth={2.5} />
            ) : (
              <span className="bg-muted-foreground/40 size-1.5 rounded-full" />
            )}
          </span>
          <span
            className={cn(
              'min-w-0 flex-1 text-[13px] leading-snug',
              item.complete ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {item.label}
            {item.optional ? (
              <span className="text-muted-foreground/80 ml-1 text-[11px]">(optional)</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
