import type { ComponentType } from 'react';

import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type AdminBookingSuccessRow = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
};

export interface AdminBookingSuccessSummaryProps {
  title: string;
  rows: AdminBookingSuccessRow[];
  onAddAnother: () => void;
  onViewBooking: () => void;
}

export function AdminBookingSuccessSummary({
  title,
  rows,
  onAddAnother,
  onViewBooking,
}: AdminBookingSuccessSummaryProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="bg-success/10 flex h-12 w-12 items-center justify-center rounded-full">
          <CheckCircle2 className="text-success h-6 w-6" aria-hidden />
        </div>
        <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      </div>

      <div className="border-border bg-card divide-border divide-y rounded-xl border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3 p-4">
            <div className={cn('bg-primary/10 shrink-0 rounded-lg p-2')}>
              <row.icon className="text-primary h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs font-medium uppercase">{row.label}</p>
              <p className="text-foreground break-words text-sm font-medium">{row.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onAddAnother}>
          Add another booking
        </Button>
        <Button type="button" onClick={onViewBooking}>
          View booking
        </Button>
      </div>
    </div>
  );
}
