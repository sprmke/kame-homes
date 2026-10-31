import {
  orgParkingAddressLine,
  orgParkingResidenceLine,
} from '@/features/dashboard/org/lib/orgParkingDisplay';
import type { Parking } from '@/features/dashboard/org/types';

export type OrgParkingCardModel = {
  title: string;
  residenceLine: string;
  addressLine: string;
  ratePerNight: number | null;
  imageUrls: string[];
  thumbnailUrl: string | null;
};

export function orgParkingCardModel(parking: Parking): OrgParkingCardModel {
  const coverImage =
    typeof parking.settings.coverImage === 'string' ? parking.settings.coverImage.trim() : '';
  const imageUrls = coverImage ? [coverImage] : [];

  return {
    title: parking.name,
    residenceLine: orgParkingResidenceLine(parking),
    addressLine: orgParkingAddressLine(parking),
    ratePerNight: parking.ratePerNight,
    imageUrls,
    thumbnailUrl: imageUrls[0] ?? null,
  };
}

export function orgParkingsSummaryFromList(parkings: Parking[]) {
  const total = parkings.length;
  const totalRevenue = parkings.reduce(
    (sum, parking) => sum + (parking.stats?.monthlyRevenue ?? 0),
    0
  );
  const avgMonthlyRevenue = total > 0 ? Math.round(totalRevenue / total) : 0;
  const occupancyRates = parkings
    .map((parking) => parking.stats?.occupancyRate)
    .filter((value): value is number => typeof value === 'number');
  const avgOccupancy =
    occupancyRates.length > 0
      ? Math.round(occupancyRates.reduce((sum, value) => sum + value, 0) / occupancyRates.length)
      : 0;

  return { total, totalRevenue, avgMonthlyRevenue, avgOccupancy };
}
