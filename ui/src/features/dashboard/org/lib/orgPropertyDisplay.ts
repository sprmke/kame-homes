import { Building2, Home } from 'lucide-react';

import {
  DEFAULT_RESIDENCE_NAME,
  propertySidebarLabel,
} from '@/features/dashboard/org/lib/propertyDisplay';
import {
  lifecyclePresentation,
  resolvePropertyLifecycleState,
  type PropertyLifecycleState,
} from '@/features/dashboard/org/lib/propertyLifecycle';
import type { Property } from '@/features/dashboard/org/types';

import {
  LISTING_STATUS_STYLES,
  semanticBadgeClasses,
  semanticBadgeDotClasses,
} from '@/lib/statusToneColors';

import type { LucideIcon } from 'lucide-react';

export type OrgPropertyStatus = 'ACTIVE' | 'INACTIVE';

/** Legacy two-state filter for parkings and super-admin tables. */
export const ORG_PROPERTY_STATUSES: {
  value: OrgPropertyStatus;
  label: string;
  badgeClassName: string;
  dotClassName: string;
}[] = [
  {
    value: 'ACTIVE',
    label: LISTING_STATUS_STYLES.ACTIVE.label,
    badgeClassName: LISTING_STATUS_STYLES.ACTIVE.badge,
    dotClassName: LISTING_STATUS_STYLES.ACTIVE.dot,
  },
  {
    value: 'INACTIVE',
    label: LISTING_STATUS_STYLES.INACTIVE.label,
    badgeClassName: LISTING_STATUS_STYLES.INACTIVE.badge,
    dotClassName: LISTING_STATUS_STYLES.INACTIVE.dot,
  },
];

/** Lifecycle filter for the org property list — one row per host-facing state. */
export const ORG_PROPERTY_LIFECYCLE_OPTIONS: {
  value: PropertyLifecycleState;
  label: string;
  badgeClassName: string;
  dotClassName: string;
}[] = (
  ['live', 'paused', 'pending_verification', 'suspended', 'archived'] as PropertyLifecycleState[]
).map((state) => {
  const presentation = lifecyclePresentation(state);
  return {
    value: state,
    label: presentation.label,
    badgeClassName: semanticBadgeClasses(presentation.variant),
    dotClassName: semanticBadgeDotClasses(presentation.variant),
  };
});

/** Lifecycle state for a property row (client mirror of the server mapper). */
export function orgPropertyLifecycleState(property: Property): PropertyLifecycleState {
  return resolvePropertyLifecycleState({
    status: property.status,
    inactiveReason: property.inactiveReason,
  });
}

export const ORG_PROPERTY_TYPES: { value: string; label: string }[] = [
  { value: 'CONDO', label: 'Condo' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'HOUSE', label: 'House' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'OTHER', label: 'Other' },
];

export function orgPropertyTypeLabel(type: string): string {
  const normalized = type.trim().toUpperCase();
  return (
    ORG_PROPERTY_TYPES.find((entry) => entry.value === normalized)?.label ??
    type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function orgPropertyTypeIcon(type: string): LucideIcon {
  const normalized = type.trim().toUpperCase();
  if (normalized === 'HOUSE' || normalized === 'VILLA' || normalized === 'CABIN') {
    return Home;
  }
  return Building2;
}

export function formatOrgPropertyCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function orgPropertyStatsOrEmpty(property: Property) {
  return (
    property.stats ?? {
      activeBookings: 0,
      monthlyRevenue: 0,
      occupancyRate: 0,
    }
  );
}

export function orgPropertyLocationLine(property: Property): string {
  const residence = property.residenceName?.trim() || DEFAULT_RESIDENCE_NAME;
  if (property.address?.trim()) {
    return `${residence} · ${property.address.trim()}`;
  }
  return residence;
}

export function orgPropertySearchHaystack(property: Property): string {
  return [
    property.name,
    property.slug,
    propertySidebarLabel(property),
    property.tower,
    property.unitNumber,
    property.towerAndUnit,
    property.residenceName,
    property.address,
    property.type,
    property.status,
    property.inactiveReason,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function orgPropertyGuestCapacity(properties: Property[]): number | null {
  const values = properties
    .map((property) => property.maxGuests)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0);
}
