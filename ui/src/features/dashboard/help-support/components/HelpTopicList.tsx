import type { ReactNode } from 'react';

import { type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description?: string;
  Icon: LucideIcon;
  onClick: () => void;
};

export function HelpTopicRow({ title, description, Icon, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'bg-card hover:bg-muted/50 flex h-full min-h-[7.5rem] w-full flex-col items-center justify-center gap-2 px-4 py-5 text-center sm:min-h-[8.5rem] sm:px-5',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset'
      )}
    >
      <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" aria-hidden />
      </div>
      <span className="min-w-0">
        <span className="text-foreground block text-[15px] font-medium leading-snug [overflow-wrap:anywhere]">
          {title}
        </span>
        {description ? (
          <span className="text-muted-foreground mt-1 block text-sm leading-snug [overflow-wrap:anywhere]">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function HelpTopicList({ children }: { children: ReactNode }) {
  return <div className="bg-border/70 grid grid-cols-1 gap-px sm:grid-cols-2">{children}</div>;
}
