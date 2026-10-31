import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = {
  title?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function HelpCard({ title, action, className, bodyClassName, children }: Props) {
  const hasHeader = Boolean(title || action);
  return (
    <Card className={cn('overflow-hidden', className)}>
      {hasHeader ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          {title ? <h2 className="text-foreground text-sm font-semibold">{title}</h2> : null}
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn(hasHeader ? 'px-4 pb-4 sm:px-5 sm:pb-5' : 'p-4 sm:p-5', bodyClassName)}>
        {children}
      </div>
    </Card>
  );
}
