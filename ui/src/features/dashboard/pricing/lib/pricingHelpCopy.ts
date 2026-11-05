import type { HelpCopyModule } from '@/lib/help/types';

/**
 * Pricing summary cards. Weekend premium is the difference between the
 * weekend and base rate; custom dates are date overrides; fixed fees are the
 * fees enabled for the listing.
 */
export const PRICING_HELP_COPY = {
  weekendPremium: {
    hint: 'How much more a weekend night costs than the base rate.',
  },
  customDates: {
    hint: 'Nights with a price you set for a specific date. They override the base and weekend rates.',
  },
  fixedFees: {
    hint: 'The fees turned on for this property, charged on top of the nightly rate.',
  },
  smartPricingNights: {
    hint: 'Nights in this view that Smart Pricing currently prices.',
  },
  parkingWeekendPremium: {
    hint: 'How much more a weekend slot costs than the base rate.',
  },
  parkingCustomDates: {
    hint: 'Nights with a price you set for a specific date. They override the base and weekend rates.',
  },
} satisfies HelpCopyModule;
