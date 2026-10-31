import type { Parking } from '@/features/dashboard/org/types';

export type ParkingSlotConflict = {
  parkingId: string;
  parkingName: string;
  orgName: string;
  orgSlug: string;
};

export function findParkingSlotConflict(
  parkings: Array<Parking & { orgName?: string; orgSlug?: string }>,
  residenceName: string,
  tower: string,
  level: string,
  slotLabel: string,
  excludeParkingId?: string
): ParkingSlotConflict | null {
  const normalizedLabel = slotLabel.trim();
  if (!tower || !level || !normalizedLabel) return null;

  const match = parkings.find(
    (p) =>
      p.id !== excludeParkingId &&
      (p.residenceName ?? '') === residenceName &&
      p.tower === tower &&
      p.level === level &&
      p.slotLabel.trim() === normalizedLabel
  );

  if (!match) return null;

  return {
    parkingId: match.id,
    parkingName: match.name,
    orgName: match.orgName ?? 'Another organization',
    orgSlug: match.orgSlug ?? '',
  };
}
