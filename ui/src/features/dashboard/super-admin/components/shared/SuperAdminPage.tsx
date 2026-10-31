import type { ReactNode } from 'react';

import { AdminPageHeader } from '@/features/dashboard/bookings/components/AdminPageHeader';
import { SuperAdminPageLoading } from '@/features/dashboard/super-admin/components/shared/SuperAdminPageLoading';

import { cn } from '@/lib/utils';

type SuperAdminPageProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Rendered between the header and `children` (summary cards, toolbars, tabs). */
  toolbar?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Show the standard loading skeleton instead of `children`. */
  isLoading?: boolean;
  /** Metric-card count for the loading skeleton (0 = list rows only). */
  loadingMetricCount?: number;
  /** Override default list/metric loading body (header stays mounted). */
  loadingBody?: ReactNode;
  /** Show a standard error message instead of `children`. */
  error?: unknown;
  errorMessage?: string;
};

/**
 * Standard Super Admin route shell — page header + consistent vertical rhythm,
 * with built-in loading / error states. Every `/admin/*` page renders through this.
 */
export function SuperAdminPage({
  title,
  subtitle,
  actions,
  toolbar,
  children,
  className,
  isLoading = false,
  loadingMetricCount = 0,
  loadingBody,
  error,
  errorMessage,
}: SuperAdminPageProps) {
  return (
    <div className={cn('space-y-3 sm:space-y-4', className)}>
      <AdminPageHeader title={title} subtitle={subtitle} actions={actions} />
      {isLoading ? (
        (loadingBody ?? <SuperAdminPageLoading metricCount={loadingMetricCount} />)
      ) : error ? (
        <p className="text-destructive text-sm">
          {errorMessage ??
            (error instanceof Error ? error.message : `Could not load ${title.toLowerCase()}.`)}
        </p>
      ) : (
        <>
          {toolbar}
          {children}
        </>
      )}
    </div>
  );
}
