import { formatParkingDisplayName } from '@/features/dashboard/org/lib/parkingSlotDisplay';

export function formatParkingLocation(
  tower: string | null | undefined,
  level: string | null | undefined,
  slotLabel: string | null | undefined
): string {
  const formatted = formatParkingDisplayName(tower ?? '', level ?? '', slotLabel ?? '');
  if (formatted) return formatted;
  return [tower, level, slotLabel].filter(Boolean).join(' · ');
}
