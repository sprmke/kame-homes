import * as React from 'react';
import type { ReactNode } from 'react';

import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function HelpDisclosure({ title, children, defaultOpen = false }: Props) {
  const ref = React.useRef<HTMLDetailsElement>(null);

  React.useEffect(() => {
    if (defaultOpen && ref.current) ref.current.open = true;
  }, [defaultOpen]);

  return (
    <details ref={ref} className="border-border/70 group border-b last:border-b-0">
      <summary
        className={cn(
          'text-foreground flex min-h-12 cursor-pointer list-none items-start justify-between gap-4 py-4 text-[15px] font-medium leading-snug sm:py-5 sm:text-base',
          'marker:hidden [&::-webkit-details-marker]:hidden',
          'hover:text-primary focus-visible:ring-ring rounded-md focus-visible:outline-none focus-visible:ring-2'
        )}
      >
        <span className="min-w-0 flex-1 text-left [overflow-wrap:anywhere]">{title}</span>
        <ChevronDown
          className="text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      <div className="text-muted-foreground w-full pb-5 text-sm leading-7 [overflow-wrap:anywhere]">
        {children}
      </div>
    </details>
  );
}
