import type { HelpCopyModule } from '@/lib/help/types';

/**
 * Org properties and parkings summary cards. Source:
 * `_shared/dashboardService.ts#computePropertyPeriodStats` uses the current
 * Manila calendar month and `ratedRevenue`, not host net.
 */
export const ORG_LISTING_HELP_COPY = {
  totalRevenue: {
    hint: 'Nightly rates booked for the current month, summed across your properties. This is not net income after costs.',
  },
  avgMonthlyRevenue: {
    hint: 'The current month booked rate divided by the number of properties.',
  },
  avgOccupancy: {
    hint: 'The average of each property booked nights divided by the nights in the current month.',
  },
  parkingTotalRevenue: {
    hint: 'Slot rates booked for the current month, summed across your parking listings. This is not net income after costs.',
  },
  parkingAvgMonthlyRevenue: {
    hint: 'The current month booked slot rate divided by the number of parking listings.',
  },
  parkingAvgOccupancy: {
    hint: 'The average of each parking listing booked nights divided by the nights in the current month.',
  },
} satisfies HelpCopyModule;
