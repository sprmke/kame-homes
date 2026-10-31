import type { Property } from '@/features/dashboard/org/types';
import type { PlatformProperty } from '@/features/dashboard/super-admin/types/platformProperty';

export function platformPropertyToProperty(property: PlatformProperty): Property {
  return {
    id: property.id,
    organizationId: property.organizationId,
    name: property.name,
    slug: property.slug,
    type: property.type,
    status: property.status,
    address: property.address,
    towerAndUnit: property.towerAndUnit,
    tower: property.tower,
    unitNumber: property.unitNumber,
    residenceName: property.residenceName,
    maxGuests: property.maxGuests,
    settings: property.settings,
    stats: property.stats,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
  };
}
