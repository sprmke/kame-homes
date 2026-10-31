import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import type { PricingHolidayRuleDto } from '@/features/dashboard/pricing/lib/phHolidayRules';
import type { PropertyPricingDefaults } from '@/features/dashboard/pricing/lib/pricingCompute';

import { supabase } from '@/lib/supabase/client';

export type PropertyPricingCalendarBooking = {
  id: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  primary_guest_name: string;
  guest_facebook_name: string;
  guest_email: string;
  guest_phone_number: string | null;
  booking_rate: number | null;
  number_of_nights: number | null;
  need_parking: boolean | null;
  has_pets: boolean | null;
  guest_requests_surprise_decor?: unknown;
  valid_id_url: string | null;
};

export type PropertyPricingDto = PropertyPricingDefaults & {
  dateOverrides: Record<string, number>;
  bookedDateKeys: string[];
  blockedDateKeys: string[];
  /** Subset of blockedDateKeys synced from an OTA calendar feed — read-only in the UI. */
  importedBlockedDateKeys: string[];
  holidayRules: PricingHolidayRuleDto[];
  calendarBookings: PropertyPricingCalendarBooking[];
  /** Applied Smart Pricing rates (YYYY-MM-DD -> nightly). Below host overrides, above holidays. */
  smartRecommendations: Record<string, number>;
  /** True when Smart Pricing is enabled for this property and the plan feature is live. */
  smartPricingEnabled: boolean;
};

export type PropertyPricingPatch = Partial<PropertyPricingDefaults> & {
  dateOverrides?: Record<string, number>;
  holidayRules?: PricingHolidayRuleDto[];
  blockRange?: { startDate: string; endDate: string; note?: string };
  unblockDateKeys?: string[];
};

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function pricingUrl(propertyId: string, month?: string): string {
  const base = scopedFunctionsUrl('/property-pricing', propertyId);
  if (!month) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}month=${encodeURIComponent(month)}`;
}

export async function fetchPropertyPricing(
  propertyId: string,
  month?: string
): Promise<PropertyPricingDto> {
  const res = await fetch(pricingUrl(propertyId, month), {
    headers: await authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error ?? json?.message ?? 'Failed to load pricing');
  }
  return {
    blockedDateKeys: [],
    importedBlockedDateKeys: [],
    calendarBookings: [],
    smartRecommendations: {},
    smartPricingEnabled: false,
    ...json.data,
  } as PropertyPricingDto;
}

export async function savePropertyPricing(
  propertyId: string,
  patch: PropertyPricingPatch
): Promise<PropertyPricingDto> {
  const res = await fetch(pricingUrl(propertyId), {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(patch),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error ?? json?.message ?? 'Failed to save pricing');
  }
  return json.data as PropertyPricingDto;
}

export const PROPERTY_PRICING_QUERY_KEY = 'property-pricing';
