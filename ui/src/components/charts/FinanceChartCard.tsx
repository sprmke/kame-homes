import type { ReactNode } from 'react';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FinanceChartCard({ icon, title, description, action, children, className }: Props) {
  return (
    <section className={cn('surface-card flex min-w-0 flex-col p-3 sm:p-4', className)}>
      <AdminSurfaceCardHeader icon={icon} title={title} description={description} action={action} />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}
