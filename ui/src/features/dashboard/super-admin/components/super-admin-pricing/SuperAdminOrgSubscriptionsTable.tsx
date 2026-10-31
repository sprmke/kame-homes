import { useEffect, useState } from 'react';

import {
  AdminDataTable,
  AdminTableHeadRow,
  AdminTableTh,
  adminTableBodyText,
  adminTableCell,
  adminTableRowClass,
} from '@/features/dashboard/bookings/components/AdminDataTable';
import type {
  OrgSubscriptionSummary,
  PricingPlan,
} from '@/features/dashboard/super-admin/types/pricingPlan';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type SuperAdminOrgSubscriptionsTableProps = {
  organizations: OrgSubscriptionSummary[];
  plans: PricingPlan[];
  onAssign: (organizationId: string, planId: string) => Promise<void>;
  isAssigning: boolean;
  onReassessSuperhost?: (organizationId: string) => void;
  reassessingOrgId?: string | null;
};

export function SuperAdminOrgSubscriptionsTable({
  organizations,
  plans,
  onAssign,
  isAssigning,
  onReassessSuperhost,
  reassessingOrgId,
}: SuperAdminOrgSubscriptionsTableProps) {
  return (
    <AdminDataTable minWidth={760}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-4 pr-3 sm:pl-5">Organization</AdminTableTh>
        <AdminTableTh className="hidden px-3 md:table-cell md:px-4">Properties</AdminTableTh>
        <AdminTableTh className="px-3 sm:px-4">Current plan</AdminTableTh>
        <AdminTableTh className="pl-2 pr-3 text-right sm:pl-3 sm:pr-4">Assign</AdminTableTh>
        {onReassessSuperhost ? (
          <AdminTableTh className="hidden pl-2 pr-4 text-right lg:table-cell">
            Superhost
          </AdminTableTh>
        ) : null}
      </AdminTableHeadRow>
      <tbody>
        {organizations.map((row, index) => (
          <OrgSubscriptionRow
            key={row.organizationId}
            row={row}
            plans={plans}
            onAssign={onAssign}
            isAssigning={isAssigning}
            onReassessSuperhost={onReassessSuperhost}
            reassessingOrgId={reassessingOrgId}
            index={index}
          />
        ))}
      </tbody>
    </AdminDataTable>
  );
}

function OrgSubscriptionRow({
  row,
  plans,
  onAssign,
  isAssigning,
  onReassessSuperhost,
  reassessingOrgId,
  index,
}: {
  row: OrgSubscriptionSummary;
  plans: PricingPlan[];
  onAssign: (organizationId: string, planId: string) => Promise<void>;
  isAssigning: boolean;
  onReassessSuperhost?: (organizationId: string) => void;
  reassessingOrgId?: string | null;
  index: number;
}) {
  const currentPlanId = row.subscription?.planId ?? plans.find((plan) => plan.isDefault)?.id ?? '';
  const [selectedPlanId, setSelectedPlanId] = useState(currentPlanId);

  useEffect(() => {
    setSelectedPlanId(currentPlanId);
  }, [currentPlanId]);

  return (
    <tr className={adminTableRowClass(index)}>
      <td className={adminTableCell.body}>
        <div className="min-w-[140px]">
          <p className={cn('truncate', adminTableBodyText.primary)}>{row.organizationName}</p>
          <p className={cn('truncate', adminTableBodyText.secondary)}>{row.organizationSlug}</p>
        </div>
      </td>
      <td className={cn(adminTableCell.body, 'hidden md:table-cell')}>
        <p className={adminTableBodyText.primary}>
          {row.propertyCount} {row.propertyCount === 1 ? 'property' : 'properties'}
        </p>
      </td>
      <td className={adminTableCell.status}>
        {row.subscription ? (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-sm">
              {row.subscription.planName ?? row.subscription.planCode}
            </span>
            <Badge variant="outline">{row.subscription.status}</Badge>
          </div>
        ) : (
          <Badge variant="secondary">Unassigned</Badge>
        )}
      </td>
      <td className={cn(adminTableCell.action, 'text-right')}>
        <div className="flex items-center justify-end gap-2">
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId} disabled={isAssigning}>
            <SelectTrigger
              className="min-h-[44px] w-[min(100%,10rem)] sm:w-40"
              aria-label={`Assign plan for ${row.organizationName}`}
            >
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={isAssigning || !selectedPlanId || selectedPlanId === currentPlanId}
            onClick={() => void onAssign(row.organizationId, selectedPlanId)}
          >
            Apply
          </Button>
        </div>
      </td>
      {onReassessSuperhost ? (
        <td className={cn(adminTableCell.action, 'hidden text-right lg:table-cell')}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[44px]"
            disabled={reassessingOrgId === row.organizationId}
            onClick={() => onReassessSuperhost(row.organizationId)}
          >
            {reassessingOrgId === row.organizationId ? 'Reassessing…' : 'Reassess'}
          </Button>
        </td>
      ) : null}
    </tr>
  );
}
