import type { ExternalReviewSource } from '@/features/dashboard/org/lib/propertyExternalReviews';

import { toneBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

export const superAdminApprovalDialogContentClass = cn(
  'flex h-[min(90dvh,44rem)] max-h-[min(90dvh,44rem)] w-[min(calc(100vw-1.5rem),40rem)] max-w-none flex-col gap-0 overflow-hidden p-0',
  'sm:w-[min(94vw,42rem)] sm:max-w-[42rem] sm:p-0'
);

export const superAdminApprovalDialogHeaderClass =
  'border-border shrink-0 space-y-2 border-b px-5 pb-4 pt-5 text-left sm:px-6';

export const superAdminApprovalDialogBodyClass =
  'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6';

export const superAdminApprovalDialogFooterClass =
  'border-border shrink-0 flex-col gap-2 border-t px-5 py-3.5 sm:flex-row sm:flex-wrap sm:justify-end sm:px-6 sm:py-4';

export const superAdminApprovalSectionTitleClass =
  'text-foreground text-xs font-semibold uppercase tracking-wide';

export const superAdminApprovalFooterButtonClass = 'min-h-[44px] w-full sm:w-auto';

export function formatSuperAdminApprovalDate(value: string | null): string {
  if (!value) return '-';
  const trimmed = value.trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const date = ymd
    ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SuperAdminApprovalInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="text-muted-foreground w-[7.5rem] shrink-0 text-xs font-medium">{label}</dt>
      <dd className="text-foreground min-w-0 text-sm">{value}</dd>
    </div>
  );
}

export function SuperAdminExternalReviewSourceBadge({ source }: { source: ExternalReviewSource }) {
  const label = source === 'airbnb' ? 'Airbnb' : 'Facebook';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
        source === 'airbnb' ? toneBadgeClasses('red') : toneBadgeClasses('blue')
      )}
    >
      {label}
    </span>
  );
}
