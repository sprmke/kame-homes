import type { OpsSeverity } from '@/features/dashboard/super-admin/lib/opsReports';

import { cn } from '@/lib/utils';

const SEVERITY_CLASS: Record<OpsSeverity, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-600 text-white',
  medium: 'bg-amber-500 text-black',
  low: 'bg-sky-600 text-white',
  info: 'bg-slate-500 text-white',
};

const STATUS_CLASS: Record<string, string> = {
  ok: 'bg-emerald-600 text-white',
  warn: 'bg-amber-500 text-black',
  error: 'bg-red-600 text-white',
  unknown: 'bg-slate-500 text-white',
  skipped: 'bg-slate-200 text-slate-700',
  partial: 'bg-amber-100 text-amber-900',
};

export function OpsSeverityBadge({
  severity,
  count,
  className,
}: {
  severity: OpsSeverity;
  count?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        SEVERITY_CLASS[severity],
        className
      )}
    >
      {severity}
      {count != null ? <span className="tabular-nums">{count}</span> : null}
    </span>
  );
}

export function OpsStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        STATUS_CLASS[status] ?? STATUS_CLASS.unknown,
        className
      )}
    >
      {status}
    </span>
  );
}
