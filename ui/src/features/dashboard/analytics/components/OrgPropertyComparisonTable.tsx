import { useMemo, useState } from 'react';

import { Link, useParams } from 'react-router-dom';

import { ArrowDown, ArrowUp, Download, Table as TableIcon } from 'lucide-react';

import { downloadCsv, orgPortfolioRowsToCsv } from '@/features/dashboard/analytics/lib/exportCsv';
import type { OrgPortfolioRow } from '@/features/dashboard/analytics/lib/types';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';
import { hasOrgPermission } from '@/features/dashboard/team/lib/orgPermissions';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type SortKey =
  'propertyName' | 'occupancyRate' | 'adr' | 'revpar' | 'grossRevenue' | 'reservations';

type Props = {
  rows: OrgPortfolioRow[];
  className?: string;
};

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'propertyName', label: 'Property' },
  { key: 'occupancyRate', label: 'Occupancy' },
  { key: 'adr', label: 'ADR' },
  { key: 'revpar', label: 'RevPAR' },
  { key: 'grossRevenue', label: 'Revenue' },
  { key: 'reservations', label: 'Reservations' },
];

export function OrgPropertyComparisonTable({ rows, className }: Props) {
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  const { data: access } = useOrgPermissions();
  const canExport = hasOrgPermission(access?.permissions, 'org.analytics:export');
  const { canUse: canExportByPlan, isLoading: exportPlanLoading } =
    useFeatureGate('analyticsInsights');
  const { open: openUpgradeModal } = useUpgradeModal();
  const [sortKey, setSortKey] = useState<SortKey>('grossRevenue');
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sortKey === 'propertyName' ? a.propertyName : a.locked ? -1 : (a[sortKey] ?? 0);
      const bv = sortKey === 'propertyName' ? b.propertyName : b.locked ? -1 : (b[sortKey] ?? 0);
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDesc ? bv.localeCompare(av) : av.localeCompare(bv);
      }
      const diff = Number(av) - Number(bv);
      return sortDesc ? -diff : diff;
    });
    return copy;
  }, [rows, sortKey, sortDesc]);

  function handleExportCsv() {
    if (!canExportByPlan) {
      if (!exportPlanLoading) openUpgradeModal('analyticsInsights');
      return;
    }
    downloadCsv(orgPortfolioRowsToCsv(rows), `portfolio-analytics-${orgSlug}.csv`);
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((v) => !v);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
    >
      <AdminSurfaceCardHeader
        icon={TableIcon}
        title="Property Comparison"
        description="Ranked by revenue in the selected period"
        iconClassName="bg-muted/80"
        action={
          canExport ? (
            <TierBadgeAnchor feature="analyticsInsights">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                onClick={handleExportCsv}
              >
                <Download className="size-3.5" aria-hidden />
                Export CSV
              </Button>
            </TierBadgeAnchor>
          ) : undefined
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-border border-b text-left">
              {COLUMNS.map((col) => (
                <th key={col.key} className="p-2 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {col.label}
                    {sortKey === col.key ? (
                      sortDesc ? (
                        <ArrowDown className="size-3" aria-hidden />
                      ) : (
                        <ArrowUp className="size-3" aria-hidden />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.propertyId} className="border-border/60 border-b last:border-0">
                <td className="p-2">
                  <Link
                    to={propertySectionPath(orgSlug, row.propertySlug, 'analytics')}
                    className="text-primary font-medium hover:underline"
                  >
                    {row.propertyName}
                  </Link>
                </td>
                {row.locked ? (
                  <td colSpan={5} className="text-muted-foreground p-2 text-xs">
                    Numbers unavailable for this property
                  </td>
                ) : (
                  <>
                    <td className="p-2 tabular-nums">{row.occupancyRate}%</td>
                    <td className="p-2 tabular-nums">{formatMoney(row.adr)}</td>
                    <td className="p-2 tabular-nums">{formatMoney(row.revpar)}</td>
                    <td className="p-2 tabular-nums">{formatMoney(row.grossRevenue)}</td>
                    <td className="p-2 tabular-nums">{row.reservations}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
