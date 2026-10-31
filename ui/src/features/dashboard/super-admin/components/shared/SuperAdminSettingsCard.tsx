import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SuperAdminSettingsCardProps = {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  headerAction?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Wrap the body in a `<form>` and call `onSubmit` (preventDefault handled). */
  onSubmit?: () => void;
};

/** Card-based settings block — replaces hand-rolled `<form>` / bordered `<div>` panels. */
export function SuperAdminSettingsCard({
  title,
  description,
  icon,
  headerAction,
  footer,
  children,
  className,
  contentClassName,
  onSubmit,
}: SuperAdminSettingsCardProps) {
  const body = (
    <>
      <CardContent className={cn('space-y-4', contentClassName)}>{children}</CardContent>
      {footer ? <div className="px-4 pb-4 sm:px-6 sm:pb-6">{footer}</div> : null}
    </>
  );

  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader
        className={cn(headerAction && 'flex-row items-start justify-between gap-3 space-y-0')}
      >
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2">
            {icon}
            <span className="min-w-0 truncate">{title}</span>
          </CardTitle>
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </CardHeader>
      {onSubmit ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {body}
        </form>
      ) : (
        body
      )}
    </Card>
  );
}

type SuperAdminSettingsRowProps = {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  /** The control (Switch, Input, Select…). */
  children: ReactNode;
  /** Stack the control under the label instead of trailing it (inputs, textareas). */
  stacked?: boolean;
  className?: string;
};

/** One label + optional description + control, 44px min target, responsive. */
export function SuperAdminSettingsRow({
  label,
  htmlFor,
  description,
  children,
  stacked = false,
  className,
}: SuperAdminSettingsRowProps) {
  if (stacked) {
    return (
      <div className={cn('space-y-1.5', className)}>
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-[44px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        className
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
