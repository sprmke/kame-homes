import type { ReactNode } from 'react';

import { FieldLabel } from '@/components/forms/FieldLabel';
import { cn } from '@/lib/utils';

export function OrgSettingsField({
  id,
  label,
  help,
  required = false,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  /** Tooltip on a ? next to the label. */
  help?: string;
  required?: boolean;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <FieldLabel htmlFor={id} label={label} required={required} help={help} />
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

export function OrgSettingsFieldGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-x-5', className)}>
      {children}
    </div>
  );
}

export function OrgSettingsFieldSpan({ children }: { children: ReactNode }) {
  return <div className="min-w-0 lg:col-span-2">{children}</div>;
}

export function OrgSettingsDivider({ className }: { className?: string }) {
  return <div className={cn('border-border/50 border-t', className)} role="presentation" />;
}

export function OrgSettingsSubsection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-1">
        <h3 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
          {title}
        </h3>
        {description ? (
          <p className="text-muted-foreground text-xs leading-snug">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
