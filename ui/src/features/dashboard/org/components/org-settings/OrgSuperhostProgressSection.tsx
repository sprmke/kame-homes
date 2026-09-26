import { Award, CheckCircle2, Circle, Shield } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { useOrgSuperhostProgress } from '@/features/dashboard/org/hooks/useOrgSuperhostProgress';
import type {
  OrgSuperhostCriteriaSnapshot,
  OrgSuperhostCriterionSnapshot,
} from '@/features/dashboard/org/lib/orgSuperhost';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function formatAssessmentDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCriterionValue(key: string, row: OrgSuperhostCriterionSnapshot): string {
  if (key === 'rating') return row.sampleSize > 0 ? row.value.toFixed(2) : '-';
  if (key === 'responseRate') {
    return row.sampleSize > 0 ? `${Math.round(row.value * 100)}%` : '-';
  }
  if (key === 'cancellationRate') {
    return row.sampleSize > 0 ? `${(row.value * 100).toFixed(1)}%` : '-';
  }
  if (key === 'activity') {
    if (row.metVia === 'hundred_nights') return `${row.totalNights ?? row.value} nights`;
    return `${row.value} stays`;
  }
  return String(row.value);
}

function formatRequired(key: string, row: OrgSuperhostCriterionSnapshot): string {
  if (key === 'rating') return `≥ ${row.required.toFixed(1)}`;
  if (key === 'responseRate') return `≥ ${Math.round(row.required * 100)}%`;
  if (key === 'cancellationRate') return `< ${row.required * 100}%`;
  if (key === 'activity') {
    return '≥ 10 stays or ≥ 100 nights';
  }
  return String(row.required);
}

const CRITERION_ROWS: { key: keyof OrgSuperhostCriteriaSnapshot; label: string }[] = [
  { key: 'rating', label: 'Overall rating' },
  { key: 'responseRate', label: 'Inbox response (24h)' },
  { key: 'cancellationRate', label: 'Cancellation rate' },
  { key: 'activity', label: 'Completed stays' },
];

function CriterionRow({
  label,
  criterionKey,
  row,
}: {
  label: string;
  criterionKey: string;
  row: OrgSuperhostCriterionSnapshot;
}) {
  const Icon = row.met ? CheckCircle2 : Circle;
  return (
    <div className="border-border flex items-start justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="flex min-w-0 items-start gap-2">
        <Icon
          className={
            row.met
              ? 'mt-0.5 size-4 shrink-0 text-emerald-600'
              : 'text-muted-foreground mt-0.5 size-4 shrink-0'
          }
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-muted-foreground text-xs">
            {formatCriterionValue(criterionKey, row)} · need {formatRequired(criterionKey, row)}
            {row.sampleSize > 0 ? ` · n=${row.sampleSize}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

export function OrgSuperhostProgressSection() {
  const { data, isLoading, isError } = useOrgSuperhostProgress();

  return (
    <AdminSection id="trust" title="Trust" icon={Shield}>
      {isLoading ? (
        <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading Superhost">
          <div className="flex flex-wrap items-center gap-2" aria-hidden>
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="border-border rounded-lg border px-3" aria-hidden>
            {CRITERION_ROWS.map((row) => (
              <div
                key={row.key}
                className="border-border flex items-start gap-2 border-b py-3 last:border-b-0"
              >
                <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : isError || !data ? (
        <p className="text-destructive text-sm">Could not load Superhost progress.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {data.earned ? (
              <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                <Award className="size-3.5" aria-hidden />
                Superhost
              </Badge>
            ) : (
              <Badge variant="secondary">Not earned</Badge>
            )}
            <span className="text-muted-foreground text-sm">
              Next assessment · {formatAssessmentDate(data.nextAssessmentAt)}
            </span>
          </div>

          <div className="border-border rounded-lg border px-3">
            {CRITERION_ROWS.map(({ key, label }) => (
              <CriterionRow key={key} label={label} criterionKey={key} row={data.criteria[key]} />
            ))}
          </div>
        </div>
      )}
    </AdminSection>
  );
}
