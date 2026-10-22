import { Link } from 'react-router-dom';

import { AlertTriangle, ChevronRight } from 'lucide-react';

import type { SuperAdminOverview } from '@/features/dashboard/super-admin/hooks/useSuperAdminOverview';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Row = { label: string; count: number; to: string };

export function SuperAdminAttentionPanel({
  attention,
  healthIssues = 0,
}: {
  attention: SuperAdminOverview['attention'];
  /** Error + warning checks from System health. */
  healthIssues?: number;
}) {
  const rows: Row[] = [
    {
      label: 'System health issues',
      count: healthIssues,
      to: superAdminPaths.health,
    },
    {
      label: 'Approvals in review',
      count: attention.pendingApprovals,
      to: `${superAdminPaths.approvals}?status=pending`,
    },
    {
      label: 'Open support tickets',
      count: attention.openTickets,
      to: superAdminPaths.support,
    },
    {
      label: 'Undisbursed parking payouts',
      count: attention.undisbursedParkingPayouts,
      to: superAdminPaths.parkingPayouts,
    },
    {
      label: 'Orgs with no live subscription',
      count: attention.unassignedSubscriptions,
      to: superAdminPaths.propertySubscriptions,
    },
  ];

  const actionable = rows.filter((row) => row.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-amber-500" aria-hidden />
          Needs attention
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {actionable.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing needs attention right now.</p>
        ) : (
          <ul className="divide-border/60 -my-1 divide-y">
            {actionable.map((row) => (
              <li key={row.label}>
                <Link
                  to={row.to}
                  className="hover:bg-muted/50 -mx-2 flex min-h-[44px] items-center justify-between gap-3 rounded-lg px-2 text-sm transition-colors"
                >
                  <span className="min-w-0 truncate">{row.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold tabular-nums text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      {row.count}
                    </span>
                    <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
