import { Link } from 'react-router-dom';

import { LayoutDashboard } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  className?: string;
};

export function AdminEntryButton({ className }: Props) {
  return (
    <Link
      to="/bookings"
      className={cn(
        'border-border bg-card text-muted-foreground shadow-elevated hover:bg-muted hover:text-foreground inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-colors',
        className
      )}
      aria-label="Admin bookings"
      title="Bookings"
    >
      <LayoutDashboard className="size-4" aria-hidden />
    </Link>
  );
}
