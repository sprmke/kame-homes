import { Check } from 'lucide-react';

import type { ResolvedCancellationPolicyDisplay } from '@/features/dashboard/org/lib/propertyCancellationPolicy';

import { cn } from '@/lib/utils';

export function CancellationPolicyDisplay({
  policy,
}: {
  policy: ResolvedCancellationPolicyDisplay;
}) {
  const toneClasses =
    policy.tone === 'positive'
      ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/50'
      : policy.tone === 'warning'
        ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
        : 'border-border bg-muted/40';

  const titleClasses =
    policy.tone === 'positive'
      ? 'text-green-800 dark:text-green-300'
      : policy.tone === 'warning'
        ? 'text-amber-900 dark:text-amber-200'
        : 'text-foreground';

  const descriptionClasses =
    policy.tone === 'positive'
      ? 'text-green-700 dark:text-green-400'
      : policy.tone === 'warning'
        ? 'text-amber-800 dark:text-amber-300'
        : 'text-muted-foreground';

  const iconClasses =
    policy.tone === 'positive'
      ? 'text-green-600 dark:text-green-400'
      : policy.tone === 'warning'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-muted-foreground';

  return (
    <div className={cn('rounded-lg border p-4', toneClasses)}>
      <div className="flex items-start gap-3">
        <Check className={cn('mt-0.5 h-5 w-5 shrink-0', iconClasses)} aria-hidden />
        <div className="min-w-0">
          <p className={cn('font-medium', titleClasses)}>{policy.title}</p>
          <p className={cn('mt-1 text-sm', descriptionClasses)}>{policy.description}</p>
        </div>
      </div>
    </div>
  );
}
