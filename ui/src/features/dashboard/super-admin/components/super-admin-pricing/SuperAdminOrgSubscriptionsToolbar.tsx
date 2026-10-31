import { Filter, Search } from 'lucide-react';

import { AdminListPerPageSelect } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { SuperAdminListViewToggle } from '@/features/dashboard/super-admin/components/shared/SuperAdminListViewToggle';
import { SuperAdminResultsMeta } from '@/features/dashboard/super-admin/components/shared/SuperAdminResultsMeta';
import type {
  SuperAdminOrgSubscriptionsFilters,
  SuperAdminOrgSubscriptionsViewMode,
} from '@/features/dashboard/super-admin/lib/superAdminPricingFilters';
import type { PricingPlan } from '@/features/dashboard/super-admin/types/pricingPlan';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = {
  filters: SuperAdminOrgSubscriptionsFilters;
  viewMode: SuperAdminOrgSubscriptionsViewMode;
  plans: PricingPlan[];
  hideTableView?: boolean;
  limit: number;
  onSearchChange: (value: string) => void;
  onPlanCodeChange: (value: string) => void;
  onViewModeChange: (mode: SuperAdminOrgSubscriptionsViewMode) => void;
  onLimitChange: (limit: number) => void;
};

export function SuperAdminOrgSubscriptionsToolbar({
  filters,
  viewMode,
  plans,
  hideTableView = false,
  limit,
  onSearchChange,
  onPlanCodeChange,
  onViewModeChange,
  onLimitChange,
}: Props) {
  const planOptions = plans.filter((plan) => plan.isActive);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="relative min-w-[min(100%,16rem)] flex-1 sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search organization…"
            className="h-10 pl-9"
            aria-label="Search organizations"
          />
        </div>

        <Select value={filters.planCode} onValueChange={onPlanCodeChange}>
          <SelectTrigger
            className="h-10 w-[min(100%,10.5rem)] shrink-0 sm:w-[10.5rem]"
            aria-label="Filter by plan"
          >
            <Filter className="size-4 shrink-0 opacity-70" aria-hidden />
            <SelectValue placeholder="All plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {planOptions.map((plan) => (
              <SelectItem key={plan.id} value={plan.code}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <AdminListPerPageSelect limit={limit} onChange={onLimitChange} />
        <SuperAdminListViewToggle
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          hideTableView={hideTableView}
        />
      </div>
    </div>
  );
}

export { SuperAdminResultsMeta as SuperAdminOrgSubscriptionsResultsMeta };
