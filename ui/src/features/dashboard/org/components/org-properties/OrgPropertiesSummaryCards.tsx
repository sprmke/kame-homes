import { Building2, Calendar, Coins, Percent } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import { ORG_LISTING_HELP_COPY } from '@/features/dashboard/org/lib/orgListingHelpCopy';
import { orgPropertiesSummaryFromList } from '@/features/dashboard/org/lib/orgPropertyCardModel';
import { formatOrgPropertyCurrency } from '@/features/dashboard/org/lib/orgPropertyDisplay';
import type { Property } from '@/features/dashboard/org/types';

import { InfoHint } from '@/components/help/InfoHint';

type Props = {
  properties: Property[];
};

export function OrgPropertiesSummaryCards({ properties }: Props) {
  const summary = orgPropertiesSummaryFromList(properties);

  return (
    <section
      aria-label="Property summary"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
    >
      <AdminMetricCard title="Total properties" value={String(summary.total)} icon={Building2} />
      <AdminMetricCard
        title="Total revenue"
        value={formatOrgPropertyCurrency(summary.totalRevenue)}
        icon={Coins}
        titleAdornment={
          <InfoHint
            label="Total revenue"
            text={ORG_LISTING_HELP_COPY.totalRevenue.hint}
            variant="metric"
          />
        }
      />
      <AdminMetricCard
        title="Avg monthly revenue"
        value={formatOrgPropertyCurrency(summary.avgMonthlyRevenue)}
        icon={Calendar}
        titleAdornment={
          <InfoHint
            label="Avg monthly revenue"
            text={ORG_LISTING_HELP_COPY.avgMonthlyRevenue.hint}
            variant="metric"
          />
        }
      />
      <AdminMetricCard
        title="Avg occupancy"
        value={`${summary.avgOccupancy}%`}
        icon={Percent}
        titleAdornment={
          <InfoHint
            label="Avg occupancy"
            text={ORG_LISTING_HELP_COPY.avgOccupancy.hint}
            variant="metric"
          />
        }
      />
    </section>
  );
}
