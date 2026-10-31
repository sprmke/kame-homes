import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { SupportTicketStatus } from '../lib/supportTicketApi';

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_CLASSES: Record<SupportTicketStatus, string> = {
  open: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-transparent',
  in_progress: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent',
  resolved: 'bg-primary/10 text-primary border-transparent',
  closed: 'bg-muted text-muted-foreground border-transparent',
};

export function SupportTicketStatusBadge({
  status,
  compact = false,
}: {
  status: SupportTicketStatus;
  compact?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_CLASSES[status], compact && 'px-1.5 py-0 text-[10px] font-medium')}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
