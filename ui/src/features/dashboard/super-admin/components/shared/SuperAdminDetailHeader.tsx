import type { ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { ChevronLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

type SuperAdminDetailHeaderProps = {
  title: string;
  subtitle?: string;
  /** Back-link target + label (e.g. `{ to: '/admin/developments', label: 'Developments' }`). */
  backTo?: { to: string; label: string };
  /** Leading visual (avatar / icon tile). */
  leading?: ReactNode;
  /** Trailing meta (badges, counts). */
  meta?: ReactNode;
  /** Extra identity row below the subtitle (e.g. link, owner). */
  details?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Header for Super Admin detail routes — back link, identity, actions. */
export function SuperAdminDetailHeader({
  title,
  subtitle,
  backTo,
  leading,
  meta,
  details,
  actions,
  className,
}: SuperAdminDetailHeaderProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {backTo ? (
        <Link
          to={backTo.to}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center gap-1 text-sm font-medium transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {backTo.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {leading}
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-admin-page-title">{title}</h1>
              {meta}
            </div>
            {subtitle ? (
              <p className="text-admin-page-subtitle max-sm:line-clamp-2">{subtitle}</p>
            ) : null}
            {details}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
    </div>
  );
}
