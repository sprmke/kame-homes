import type { ParkingSlot } from '../types';

export type ParkingLocationBadge = 'inside_tower' | 'outside_tower';

/** Map slot type to Inside / Outside tower badges (motorcycle bays → outside). */
export function resolveParkingLocationBadge(slot: ParkingSlot): ParkingLocationBadge {
  if (slot.type === 'inside_tower') return 'inside_tower';
  return 'outside_tower';
}

/** Inside tower shows tower + floor; outside tower shows tower only. */
export function formatParkingSlotLocation(slot: ParkingSlot): string {
  if (resolveParkingLocationBadge(slot) === 'inside_tower') {
    return [slot.tower, slot.level].filter(Boolean).join(' · ');
  }
  return slot.tower;
}
