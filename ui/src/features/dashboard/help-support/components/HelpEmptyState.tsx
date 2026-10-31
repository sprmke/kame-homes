import type { ReactNode } from 'react';

import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
  compact?: boolean;
};

export function HelpEmptyState({ icon: Icon, title, action, compact = false }: Props) {
  return (
    <div
      className={
        compact
          ? 'flex flex-col items-center justify-center px-4 py-10 text-center sm:py-12'
          : 'flex flex-col items-center justify-center px-6 py-16 text-center sm:py-20'
      }
    >
      <div className="bg-primary/10 text-primary mb-4 flex size-14 items-center justify-center rounded-2xl">
        <Icon className="size-6" aria-hidden />
      </div>
      <p className="text-foreground max-w-sm text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
        {title}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
