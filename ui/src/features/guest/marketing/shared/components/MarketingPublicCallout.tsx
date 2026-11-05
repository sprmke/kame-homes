import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

interface MarketingPublicCalloutProps {
  icon: LucideIcon;
  title: string;
  body: ReactNode;
  actions?: ReactNode;
  variant?: 'inset' | 'band';
  className?: string;
}

export function MarketingPublicCallout({
  icon: Icon,
  title,
  body,
  actions,
  variant = 'inset',
  className,
}: MarketingPublicCalloutProps) {
  const content = (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:gap-6',
        variant === 'inset' && 'border-border bg-muted/40 rounded-2xl border p-4 md:p-6 lg:p-8',
        variant === 'band' && 'container mx-auto px-4 sm:px-6 lg:px-8',
        className
      )}
    >
      <div className="flex gap-3 md:gap-4">
        <div className="public-icon-well bg-primary/10 text-primary">
          <Icon className="size-[18px] md:size-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-foreground text-base font-semibold md:text-lg lg:text-xl">{title}</h2>
          <div className="text-muted-foreground mt-1 text-sm leading-relaxed md:mt-2">{body}</div>
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center md:gap-3">
          {actions}
        </div>
      ) : null}
    </div>
  );

  if (variant === 'band') {
    return (
      <section className="bg-muted/40 border-border public-section-y border-y">{content}</section>
    );
  }

  return content;
}
