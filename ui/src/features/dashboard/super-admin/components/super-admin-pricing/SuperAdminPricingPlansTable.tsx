import {
  AdminDataTable,
  AdminTableHeadRow,
  AdminTableTh,
  adminTableBodyText,
  adminTableCell,
  adminTableRowClass,
} from '@/features/dashboard/bookings/components/AdminDataTable';
import { formatPricingPlanHostPrice } from '@/features/dashboard/super-admin/lib/pricingPlanDisplay';
import type { PricingPlan } from '@/features/dashboard/super-admin/types/pricingPlan';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SuperAdminPricingPlansTableProps = {
  plans: PricingPlan[];
  onEdit: (plan: PricingPlan) => void;
};

export function SuperAdminPricingPlansTable({ plans, onEdit }: SuperAdminPricingPlansTableProps) {
  return (
    <AdminDataTable minWidth={720}>
      <AdminTableHeadRow>
        <AdminTableTh className="pl-4 pr-3 sm:pl-5">Plan</AdminTableTh>
        <AdminTableTh className="px-3 sm:px-4">Host price</AdminTableTh>
        <AdminTableTh className="hidden px-3 md:table-cell md:px-4">AI credits/month</AdminTableTh>
        <AdminTableTh className="px-3 sm:px-4">Status</AdminTableTh>
        <AdminTableTh className="pl-2 pr-3 text-right sm:pl-3 sm:pr-4">Actions</AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {plans.map((plan, index) => (
          <tr key={plan.id} className={adminTableRowClass(index)}>
            <td className={adminTableCell.body}>
              <div className="min-w-[120px]">
                <p className={cn('truncate', adminTableBodyText.primary)}>{plan.name}</p>
                <p className={cn('truncate', adminTableBodyText.secondary)}>{plan.code}</p>
              </div>
            </td>
            <td className={adminTableCell.body}>
              <p className={cn('tabular-nums', adminTableBodyText.secondary)}>
                {formatPricingPlanHostPrice(plan)}
              </p>
            </td>
            <td className={cn(adminTableCell.body, 'hidden tabular-nums md:table-cell')}>
              <p className={adminTableBodyText.secondary}>
                {plan.features.aiMonthlyCreditAllowance.toLocaleString()}
              </p>
            </td>
            <td className={adminTableCell.status}>
              <div className="flex flex-wrap gap-1">
                {plan.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                {!plan.isActive ? <Badge variant="outline">Inactive</Badge> : null}
              </div>
            </td>
            <td className={cn(adminTableCell.action, 'text-right')}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                onClick={() => onEdit(plan)}
              >
                Edit
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}
