import { ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  summary: string;
  onManage: () => void;
  disabled?: boolean;
  /** Inside TelegramNotificationModuleLayout manage section */
  nested?: boolean;
  className?: string;
};

export function TelegramSettingsManageCard({
  icon: Icon,
  title,
  summary,
  onManage,
  disabled,
  nested = false,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex min-h-[44px] items-center gap-3 px-3 py-2.5 sm:px-3',
        nested
          ? 'border-border/40 bg-muted/15 rounded-lg border'
          : 'border-border/60 bg-card rounded-xl border py-3 sm:px-4',
        className
      )}
    >
      <div
        className="bg-muted/60 text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg"
        aria-hidden
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground truncate text-xs">{summary}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        className="min-h-[44px] shrink-0 gap-1 px-3"
        onClick={onManage}
      >
        Manage
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
