import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type ShellProps = {
  title: string;
  children: ReactNode;
  header?: ReactNode;
  className?: string;
};

export function KameSidePanelShell({ title, children, header, className }: ShellProps) {
  return (
    <div className={cn('kame-side-panel flex h-full min-h-0 flex-col', className)}>
      <div className="border-border shrink-0 border-b px-4 py-3">
        <h2 className="text-foreground text-sm font-semibold">{title}</h2>
      </div>
      {header ? <div className="border-border shrink-0 border-b px-4 py-3">{header}</div> : null}
      <div className="kame-side-panel-body min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {children}
      </div>
    </div>
  );
}

type GroupProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function KameSidePanelGroup({ label, children, className }: GroupProps) {
  return (
    <section className={cn('space-y-2', className)}>
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{label}</p>
      {children}
    </section>
  );
}
