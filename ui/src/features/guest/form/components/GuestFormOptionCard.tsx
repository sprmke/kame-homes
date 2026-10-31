import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type GuestFormOptionCardProps = {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
};

/** SD-form-style selectable card for yes/no steps (parking, pets). */
export function GuestFormOptionCard({
  selected,
  onSelect,
  title,
  description,
  children,
}: GuestFormOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'min-h-[44px] w-full space-y-1 rounded-xl border px-4 py-3 text-left transition-all duration-200',
        selected
          ? 'border-primary bg-primary/5 shadow-soft ring-primary/20 ring-1'
          : 'border-border/60 bg-card hover:border-primary/25 hover:bg-muted/40 hover:shadow-elevated'
      )}
    >
      <p className="text-foreground text-sm font-semibold">{title}</p>
      {description ? (
        <p className="text-muted-foreground mt-0.5 text-sm leading-snug">{description}</p>
      ) : null}
      {children}
    </button>
  );
}

type GuestFormInfoCalloutProps = {
  title: string;
  children: ReactNode;
};

export function GuestFormInfoCallout({ title, children }: GuestFormInfoCalloutProps) {
  return (
    <div
      className="border-primary/15 bg-primary/5 text-muted-foreground space-y-3 rounded-xl border px-4 py-3 text-sm leading-relaxed"
      role="note"
    >
      <p className="text-foreground font-semibold">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
