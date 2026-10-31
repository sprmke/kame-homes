import { DEFAULT_RESIDENCE_NAME } from '@/features/dashboard/org/lib/propertyDisplay';
import {
  propertyCardTitle,
  propertyTowerUnitLine,
} from '@/features/dashboard/org/lib/propertyDisplay';
import { partitionPropertyMedia } from '@/features/dashboard/org/lib/propertyMedia';
import { propertyProfileDraftFromProperty } from '@/features/dashboard/org/lib/propertySettingsForm';
import type { Property } from '@/features/dashboard/org/types';

export type OrgPropertyCardModel = {
  title: string;
  subtitle: string | null;
  description: string | null;
  locationLine: string;
  imageUrls: string[];
  thumbnailUrl: string | null;
};

export function orgPropertyCardModel(property: Property): OrgPropertyCardModel {
  const draft = propertyProfileDraftFromProperty(property);
  const { images } = partitionPropertyMedia(draft.media);
  const imageUrls = images.map((item) => item.url);
  const thumbnailUrl = images.find((item) => item.isPrimary)?.url ?? images[0]?.url ?? null;

  const residence = property.residenceName?.trim() || DEFAULT_RESIDENCE_NAME;
  const city = draft.city.trim();
  const province = draft.province.trim();
  const locationLine = [residence, city, province].filter(Boolean).join(', ');

  const title = propertyCardTitle(property);
  const towerUnit = propertyTowerUnitLine(property);
  const subtitle =
    towerUnit && towerUnit.trim().toLowerCase() !== title.trim().toLowerCase() ? towerUnit : null;

  return {
    title,
    subtitle,
    description: draft.description.trim() || null,
    locationLine,
    imageUrls,
    thumbnailUrl,
  };
}

export function orgPropertiesSummaryFromList(properties: Property[]) {
  const total = properties.length;
  const totalRevenue = properties.reduce(
    (sum, property) => sum + (property.stats?.monthlyRevenue ?? 0),
    0
  );
  const avgMonthlyRevenue = total > 0 ? Math.round(totalRevenue / total) : 0;
  const occupancyRates = properties
    .map((property) => property.stats?.occupancyRate)
    .filter((value): value is number => typeof value === 'number');
  const avgOccupancy =
    occupancyRates.length > 0
      ? Math.round(occupancyRates.reduce((sum, value) => sum + value, 0) / occupancyRates.length)
      : 0;

  return { total, totalRevenue, avgMonthlyRevenue, avgOccupancy };
}
