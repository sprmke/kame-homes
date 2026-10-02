import type { SuperAdminAiPlanUsage } from '@/features/dashboard/super-admin/hooks/useSuperAdminAiUsage';

import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatCredits(n: number): string {
  return n.toLocaleString('en-US');
}

export function AiPlanUsageCard({ rows }: { rows: SuperAdminAiPlanUsage[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-section-title">Usage by plan</h2>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Orgs</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead className="hidden md:table-cell">Spend</TableHead>
                <TableHead className="hidden md:table-cell">Calls</TableHead>
                <TableHead>This month</TableHead>
                <TableHead className="hidden md:table-cell">At allowance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const included = r.creditAllowancePerOrg * r.orgCount;
                return (
                  <TableRow key={r.planCode}>
                    <TableCell className="font-medium">{r.planName}</TableCell>
                    <TableCell className="tabular-nums">
                      {r.activeOrgs} / {r.orgCount}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatCredits(r.credits)}</TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      ${r.costUsd.toFixed(2)}
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">{r.calls}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatCredits(r.monthCredits)}
                      {included > 0 ? ` / ${formatCredits(included)}` : ''}
                    </TableCell>
                    <TableCell
                      className={
                        r.orgsAtAllowance > 0
                          ? 'text-destructive hidden font-medium tabular-nums md:table-cell'
                          : 'hidden tabular-nums md:table-cell'
                      }
                    >
                      {r.orgsAtAllowance}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
