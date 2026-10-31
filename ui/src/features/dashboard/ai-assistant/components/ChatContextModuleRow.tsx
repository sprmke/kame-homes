import type { ComponentType } from 'react';

import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  hint?: string;
  onSelect: () => void;
};

export function ChatContextModuleRow({ icon: Icon, label, count, hint, onSelect }: Props) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      onClick={onSelect}
      className={cn(
        'native-press focus-visible:ring-ring flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left',
        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2'
      )}
    >
      <span className="bg-muted text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-medium">{label}</span>
        {hint ? (
          <span className="text-primary mt-0.5 block text-xs font-medium">{hint}</span>
        ) : null}
      </span>
      {count != null ? (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{count}</span>
      ) : null}
      <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </button>
  );
}
