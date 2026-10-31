import type { ThreadStatusFilter } from '@/features/dashboard/inbox/types/inbox';

import { cn } from '@/lib/utils';

const STATUS_OPTIONS: { value: ThreadStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'pending', label: 'Pending' },
  { value: 'replied', label: 'Replied' },
];

type Props = {
  statusFilter: ThreadStatusFilter;
  onStatusFilter: (v: ThreadStatusFilter) => void;
};

export function InboxFilterBar({ statusFilter, onStatusFilter }: Props) {
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {STATUS_OPTIONS.map((opt) => {
        const active = statusFilter === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onStatusFilter(opt.value)}
            className={cn(
              'min-h-[36px] shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:min-h-[32px]',
              active
                ? 'bg-foreground/5 text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
