import { useEffect, useState, type ReactNode } from 'react';

import { ChevronDown, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

interface StyleSectionProps {
  title?: string;
  titleContent?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
  /** Keep children mounted when collapsed (hidden) — avoids remounting heavy panels e.g. music browse. */
  keepChildrenMounted?: boolean;
}

export function StyleSection({
  title,
  titleContent,
  icon,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
  className,
  headerActions,
  keepChildrenMounted = false,
}: StyleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  useEffect(() => {
    if (!isControlled) {
      setInternalOpen(defaultOpen);
    }
  }, [defaultOpen, isControlled]);

  const setIsOpen = (next: boolean) => {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  return (
    <div className={cn('border-border w-full min-w-0 max-w-full border-b', className)}>
      <div className="hover:bg-accent/50 flex w-full items-center justify-between px-4 py-3 transition-colors">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left"
        >
          {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
          {titleContent ?? <span className="truncate text-sm font-medium">{title}</span>}
          {isOpen ? (
            <ChevronDown className="text-muted-foreground ml-auto size-4 shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground ml-auto size-4 shrink-0" />
          )}
        </button>
        {headerActions ? <div className="ml-1 shrink-0">{headerActions}</div> : null}
      </div>

      {keepChildrenMounted ? (
        <div className={cn('min-w-0 max-w-full overflow-x-hidden px-4 pb-4', !isOpen && 'hidden')}>
          {children}
        </div>
      ) : isOpen ? (
        <div className="min-w-0 max-w-full overflow-x-hidden px-4 pb-4">{children}</div>
      ) : null}
    </div>
  );
}

interface StyleSubSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function StyleSubSection({ title, defaultOpen = true, children }: StyleSubSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-border bg-muted/30 mt-3 rounded-lg border">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-muted-foreground text-xs font-medium">{title}</span>
        {isOpen ? (
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
        )}
      </button>

      {isOpen && <div className="border-border space-y-3 border-t px-3 py-3">{children}</div>}
    </div>
  );
}
