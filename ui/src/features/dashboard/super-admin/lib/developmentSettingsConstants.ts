import type { DevelopmentType } from '@/features/dashboard/super-admin/types/development';

export const DEVELOPMENT_TYPES: { value: DevelopmentType; label: string }[] = [
  { value: 'CONDOMINIUM', label: 'Condominium' },
  { value: 'SUBDIVISION', label: 'Subdivision' },
  { value: 'MIXED_USE', label: 'Mixed use' },
  { value: 'TOWNHOUSE', label: 'Townhouse' },
  { value: 'COMMERCIAL', label: 'Commercial' },
];

export const DEVELOPMENT_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
] as const;

export const DEVELOPMENT_AMENITY_SUGGESTIONS = [
  'Lagoon Pool',
  'Infinity Pool',
  'Gym & Fitness Center',
  'Clubhouse',
  'Basketball Court',
  'Jogging Trail',
  "Children's Play Area",
  '24/7 Security',
  'CCTV Surveillance',
  'Function Rooms',
  'Commercial Strip',
  'Sky Lounge',
  'Co-working Spaces',
  'Concierge Service',
  'Rooftop Garden',
] as const;

export function developmentTypeLabel(type: string): string {
  return DEVELOPMENT_TYPES.find((entry) => entry.value === type)?.label ?? type;
}

export function developmentStatusLabel(status: string): string {
  return DEVELOPMENT_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}
