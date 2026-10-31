import { Bike, Car } from 'lucide-react';

import { formatOrgPropertyCurrency } from '@/features/dashboard/org/lib/orgPropertyDisplay';
import {
  DEFAULT_PARKING_RESIDENCE_NAME,
  PARKING_TYPES,
} from '@/features/dashboard/org/lib/parkingResidences';
import { resolveParkingCompactLabel } from '@/features/dashboard/org/lib/parkingSlotDisplay';
import type { Parking } from '@/features/dashboard/org/types';
import { parkingLocationDraftFromSettings } from '@/features/dashboard/parking/lib/parkingSettingsForm';

import type { LucideIcon } from 'lucide-react';

export { formatOrgPropertyCurrency as formatOrgParkingCurrency };

export type OrgParkingStatus = 'ACTIVE' | 'INACTIVE';

export const ORG_PARKING_STATUSES: {
  value: OrgParkingStatus;
  label: string;
}[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export const ORG_PARKING_TYPES = PARKING_TYPES.map((entry) => ({
  value: entry.value,
  label: entry.label,
}));

export function orgParkingTypeLabel(type: string): string {
  const normalized = type.trim();
  return (
    ORG_PARKING_TYPES.find((entry) => entry.value === normalized)?.label ??
    normalized.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function orgParkingTypeIcon(type: string): LucideIcon {
  return type === 'motorcycle' ? Bike : Car;
}

export function orgParkingStatsOrEmpty(parking: Parking) {
  return (
    parking.stats ?? {
      activeReservations: 0,
      monthlyRevenue: 0,
      occupancyRate: 0,
    }
  );
}

export function orgParkingResidenceLine(parking: Parking): string {
  return parking.residenceName?.trim() || DEFAULT_PARKING_RESIDENCE_NAME;
}

/** City/province (or street address fallback) for card meta — shown below residence. */
export function orgParkingAddressLine(parking: Parking): string {
  const draft = parkingLocationDraftFromSettings(parking.settings, parking.residenceName);
  const city = draft.city.trim();
  const province = draft.province.trim();
  const region = [city, province].filter(Boolean).join(', ');
  if (region) return region;
  return draft.address.trim();
}

/** @deprecated Prefer orgParkingResidenceLine + orgParkingAddressLine on listing cards. */
export function orgParkingLocationLine(parking: Parking): string {
  return orgParkingResidenceLine(parking);
}

export function orgParkingSearchHaystack(parking: Parking): string {
  return [
    parking.name,
    parking.slug,
    resolveParkingCompactLabel(parking),
    parking.tower,
    parking.level,
    parking.slotLabel,
    parking.residenceName,
    parking.parkingType,
    parking.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
